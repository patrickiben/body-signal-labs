#!/usr/bin/env python3
"""Production EEG controller + UI against a deterministic private-relay fixture.
No real headset is emulated or claimed: fixtures carry valid Athena-shaped bytes
at the relay feature boundary, while all controller quality/reference rules run.
"""
import json, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp())
OUT.mkdir(parents=True, exist_ok=True)
GPU = ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl']
FIXTURE = r"""
window.__BODY_EEG_RELAY__={base:'/eeg-test/',session:'test-session',simulated:false};
window.__eegClock=Date.now();window.__eegCalls=[];let factory,sequence=0,paired=false;
Object.defineProperty(window,'createEEGDrive',{configurable:true,get(){return options=>factory({...options,now:()=>window.__eegClock});},set(fn){factory=fn;}});
const originalFetch=window.fetch;
window.fetch=async(url,init={})=>{
 if(!String(url).startsWith('/eeg-test/'))return originalFetch(url,init);
 __eegCalls.push({url,body:init.body});
 if(init.body){const p=JSON.parse(init.body);if(p.action==='connect')paired=true;if(p.action==='disconnect')paired=false;}
 const state={session:'test-session',server_now:__eegClock,simulated:false,devices:{muse:{device:'muse',phase:paired?'streaming':'disconnected',deviceName:paired?'Muse S Athena':''}},discovery:{devices:[{kind:'muse',id:'athena-one',name:'Muse S Athena <b>fixture</b>'}]}};
 return {ok:true,json:async()=>state};
};
window.EventSource=class {constructor(url){this.url=url;window.__eegStream=this;}close(){this.closed=true;}};
window.__eegPush=(ratio=1,valid=true)=>{
 __eegClock+=1000;
 const q={valid,received_at:__eegClock,source:'muse:athena:eeg:0,1',source_kind:'device-reported',channels:[0,1],sample_rate_hz:256,window_seconds:4,reason:valid?'Software gates passed; contact unverified.':'Waiting for the initial 4-second EEG buffer.'};
 __eegStream.onmessage({data:JSON.stringify({kind:'features',session:'test-session',sequence:++sequence,server_sent_at:__eegClock,payload:{type:'features',source:'device-reported',received_at:__eegClock,eeg_beta_alpha:ratio,quality:{eeg_beta_alpha:q}}})});
};
window.__eegSettle=()=>{for(let i=0;i<4;i++)__app.eeg.tick(5,false);};
"""
checks=[]
def check(name, ok, detail=None):
    checks.append(name); print(('PASS ' if ok else 'FAIL ')+name+(f' {detail}' if detail else ''),flush=True); assert ok,name

def state(pg):
    return pg.evaluate("({power:__app.S.drivePower,rpm:__app.S.rpm,speed:__app.S.speed,vis:__app.S.vis,score:__app.S.eegScore,drive:__app.S.eegDrive,calm:__app.S.motionCalm,wild:__app.S.effectiveWild,phase:__app.eeg.state.phase,progress:__app.eeg.state.progress,baseline:__app.eeg.state.baseline,source:document.getElementById('source-label').textContent})")

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=GPU)
    plain=browser.new_page(viewport={'width':1280,'height':800});plain_errors=[]
    plain.on('pageerror',lambda e:plain_errors.append(str(e)))
    plain.goto((ROOT/'biofeedback-path-cockpit.html').as_uri());plain.wait_for_function('window.__app')
    plain.click('[data-mode=ride]');plain.click('[data-power=brainwaves]');plain.wait_for_timeout(200)
    check('standalone Brainwaves offers setup and stays stopped',plain.evaluate("!__app.eeg.state.available && __app.S.speed===0 && !document.getElementById('eeg-setup').hidden"))
    plain.screenshot(path=str(OUT/'brainwaves-standalone.png'));check('standalone runtime has no errors',not plain_errors,plain_errors);plain.close()
    page=browser.new_page(viewport={'width':1280,'height':800},accept_downloads=True);errors=[]
    page.add_init_script(FIXTURE);page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto((ROOT/'biofeedback-path-cockpit.html').as_uri());page.wait_for_function('window.__app')
    page.click('[data-mode=ride]');page.click('[data-power=brainwaves]')
    check('Brainwaves selection makes no automatic network or pairing request',page.evaluate('__eegCalls.length===0'))
    page.click('#connect-button');page.click('#eeg-start');page.wait_for_function('!__app.S.eegBusy')
    check('discovered headset names are rendered as text',page.locator('#eeg-device').inner_text().find('<b>fixture</b>')>=0 and page.locator('#eeg-device b').count()==0)
    check('scan alone never pairs a headset',page.evaluate("!__eegCalls.some(c=>c.body&&JSON.parse(c.body).action==='connect')"))
    page.select_option('#eeg-device','athena-one');page.click('#eeg-pair');page.wait_for_function('!__app.S.eegBusy')
    page.evaluate('__eegPush(1,false)');page.wait_for_timeout(150)
    check('initial buffer does not calibrate or propel',page.evaluate('__app.eeg.state.progress===0 && __app.S.speed===0'))
    page.evaluate('for(let i=0;i<19;i++)__eegPush(1,true)');page.wait_for_timeout(150)
    check('personal reference requires20 eligible samples',page.evaluate('__app.eeg.state.baseline===null && __app.eeg.state.progress===.95 && __app.S.speed===0'))
    page.evaluate('__eegPush(1,true)');page.wait_for_timeout(100);page.evaluate('__eegSettle()');page.wait_for_timeout(150)
    check('valid Athena reference drives with no cadence',page.evaluate('__app.eeg.state.baseline.samples===20 && __app.S.speed>3 && __app.S.rpm===0 && __app.bio.cadence.rpm===null'))
    page.click('#connect-sheet [data-close]');page.evaluate('__eegPush(1.4);__eegSettle()');page.wait_for_timeout(180);low=state(page)
    page.evaluate('__eegPush(.7);__eegSettle()');page.wait_for_timeout(180);high=state(page)
    check('higher EEG control is faster and steadier',high['speed']>low['speed']+3 and high['wild']<low['wild'] and high['calm']<low['calm'],{'low':low['speed'],'high':high['speed']})
    page.evaluate('__app.S.steady=120;__app.S.auto=true;__app.S.pedal=true;__app.bio.cadence.state="live";__app.bio.cadence.rpm=200;__app.bio.now.hr=230;__app.bio.now.baseHr=50');page.wait_for_timeout(250)
    check('cadence, heart rate and manual pedal cannot propel EEG mode',page.evaluate('__app.S.rpm===0 && __app.S.gradeLoad===0 && __app.S.speed<=7') and abs(state(page)['speed']-high['speed'])<.2)
    check('HUD identifies EEG proxy rather than cadence',page.locator('#g-power-label').text_content()=='EEG control / 100' and 'proxy' in page.locator('#ep-cad').inner_text().lower() and page.locator('#pedal').is_hidden())
    page.screenshot(path=str(OUT/'brainwaves-ready.png'))
    page.evaluate('__eegClock+=6000');page.wait_for_timeout(200);coast=state(page)
    page.evaluate('__eegSettle()');page.wait_for_timeout(200);stopped=state(page);page.wait_for_timeout(400)
    check('stale EEG gently coasts then stops with no ambient drift',coast['speed']>0 and stopped['speed']==0 and abs(state(page)['vis']-stopped['vis'])<.001)
    page.click('[data-power=cadence]');page.wait_for_timeout(800)
    check('switching back restores ordinary cadence control',page.evaluate('__app.S.rpm>100 && __app.S.speed>7') and page.locator('#g-power-label').text_content()=='Cadence')
    before=page.evaluate('__app.S.rpm');page.evaluate('__app.setDrivePower("cadence",true)')
    check('an initial unchanged power lane preserves restored cadence',page.evaluate('__app.S.rpm')>=before*.98)
    page.click('[data-power=brainwaves]');page.click('#demo-button');page.wait_for_timeout(1000)
    check('brainwave demo is labeled synthetic and needs no headset',page.evaluate('__app.S.eegSimulated && __app.S.speed>0 && __app.S.rpm===0') and 'synthetic EEG preview' in page.locator('#source-label').inner_text())
    page.click('#session-button');page.click('#rec-toggle');page.wait_for_timeout(800)
    with page.expect_download() as dl:page.click('#rec-toggle')
    session_file=OUT/'brainwave-session.json';dl.value.save_as(session_file);session=json.loads(session_file.read_text())
    check('EEG recording saves power, quality, score and synthetic provenance',session['synthetic'] and session['start']['drivePower']=='brainwaves' and len(session['lanes']['eeg'])>2 and all(x[1]==0 for x in session['lanes']['rpm']))
    page.set_input_files('#replay-file',str(session_file));page.wait_for_timeout(200)
    check('EEG replay uses recorded control and source labels',page.evaluate('__app.bio.replayOn && __app.S.drivePower==="brainwaves" && __app.S.rpm===0') and 'EEG control includes synthetic' in page.locator('#source-label').inner_text())
    page.click('#session-button');page.click('#replay-stop')
    malformed=json.loads(json.dumps(session));malformed['lanes']['eeg'][0][1]['drive']=2
    bad=OUT/'malformed-eeg.json';bad.write_text(json.dumps(malformed));page.set_input_files('#replay-file',str(bad));page.wait_for_timeout(100)
    check('malformed EEG controls are rejected before replay',page.evaluate('!__app.bio.replayOn') and 'Invalid session EEG' in page.locator('#rec-status').inner_text())
    zero=json.loads(json.dumps(session));zero['lanes']['eeg'][0][1]['ratio']=0;zero['synthetic']=False
    validated=page.evaluate('(s)=>__app.bio.readSession(s)',zero)
    check('valid zero-beta ratio roundtrips and synthetic flags cannot be removed',validated['lanes']['eeg'][0][1]['ratio']==0 and validated['synthetic'])
    invalid=page.evaluate('''(s)=>['phase','ratio','score','simulated'].every(k=>{const x=JSON.parse(JSON.stringify(s));const v=x.lanes.eeg[0][1];v[k]=k==='phase'?'waiting':k==='ratio'?51:k==='score'?null:'false';try{__app.bio.readSession(x);return false;}catch(e){return /Invalid session EEG/.test(e.message);}})''',zero)
    check('inconsistent or malformed EEG readiness is rejected',invalid)
    coast_file=OUT/'recorded-coast.json'
    coast_session=json.loads(json.dumps(session));coast_session['durationMs']=1200
    coast_control={'score':None,'drive':.4,'ratio':None,'valid':False,'simulated':True,'phase':'stale','reason':'Recorded coast after EEG quality was lost.'}
    coast_session['lanes']={'mode':[[0,'ride']],'drivePower':[[0,'brainwaves']],'rpm':[[0,200]],'eeg':[[0,coast_control],[650,{**coast_control,'drive':.1}],[1100,{**coast_control,'drive':0}]]}
    coast_file.write_text(json.dumps(coast_session));page.set_input_files('#replay-file',str(coast_file));page.wait_for_timeout(200)
    early=state(page);page.wait_for_timeout(550);late=state(page)
    check('recorded invalid-signal coast replays without a second decay',early['score'] is None and abs(early['speed']-2.8)<.01 and abs(late['speed']-.7)<.01 and late['rpm']==0)
    check('EEG integration has no page errors',not errors,errors)
    (OUT/'results.json').write_text(json.dumps({'checks':checks,'low':low,'high':high,'errors':errors},indent=2));browser.close()
    print(f'{len(checks)} brainwave checks passed.',flush=True)
