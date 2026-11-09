/* family.js: the same-tab bar shared by the suite's home page and its three apps, in the same order everywhere.
   The repositories sit side by side on the public site and on disk, so one relative path works in both places. */
(function (global) {
  'use strict';
  const MEMBERS = [
    { id: 'home', label: 'Body Signal Labs', href: 'index.html' },
    { id: 'autonomic-telemetry', label: 'Autonomic Telemetry', href: 'autonomic/Autonomic_Telemetry_Console.html' },
    { id: 'endless-cockpit', label: 'Endless Cockpit', href: 'endless-cockpit.html' },
    { id: 'biofeedback-path-cockpit', label: 'Biofeedback Path Cockpit', href: 'biofeedback-path-cockpit.html' },
  ];
  global.familyNav = (id) => (MEMBERS.some((m) => m.id === id)
    ? `<nav class="family chrome" aria-label="Body Signal Labs">${MEMBERS.map((m) => `<a href="${m.href}"${m.id === id ? ' aria-current="page"' : ''}>${m.label}</a>`).join('')}</nav>`
    : '');
})(window);
