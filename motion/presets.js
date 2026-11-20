(() => {
  'use strict';

  // A proposer produces IDs only. The player consumes approved IDs in the DOM.
  const choices = Object.freeze({
    'text:explain': ['T01', 'T02'],
    'text:emphasize': ['T06', 'T01'],
    'diagram:relationship': ['I05', 'I01', 'I02'],
    'image:compare': ['P01', 'P02'],
    'image:annotate': ['P08', 'P02'],
    'chart:compare': ['C01', 'C09'],
    'chart:trend': ['C02', 'C09'],
    'line:relationship': ['L03', 'L01'],
    'line:progress': ['L08', 'L03'],
    'table:compare': ['B01', 'B03'],
    'table:change': ['B07', 'B01'],
    'scene:sequence': ['S02', 'S01'],
    'scene:detail': ['S03', 'S01'],
  });

  function recommend({ kind, purpose, dense = false, motionAllowed = true } = {}) {
    if (!motionAllowed || dense) return [];
    return [...(choices[`${kind}:${purpose}`] ?? [])];
  }

  function setEffect(element, id) {
    if (!window.MotionEffects.ids.includes(id)) return false;
    element.dataset.msEffect = id;
    return true;
  }

  window.MotionPresets = Object.freeze({ recommend, setEffect });
})();

