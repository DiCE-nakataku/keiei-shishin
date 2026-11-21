(function (global) {
  function targetNarrativeStyle(text) {
    const length = Array.from(String(text || '')).length;
    const fontSize = length > 300 ? 8 : length > 200 ? 8.6 : 9.5;
    return `font-size:${fontSize}pt;line-height:1.4;padding:7px 9px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere;`;
  }

  function splitTargetNarrative(text, limit = 1000) {
    const source = String(text || '');
    if (!source) return [''];
    const chunks = [];
    let rest = source;
    while (rest.length > limit) {
      let cut = rest.lastIndexOf('\n', limit);
      if (cut < limit * 0.55) cut = limit;
      else cut++;
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    chunks.push(rest);
    return chunks;
  }

  global.targetNarrativeStyle = targetNarrativeStyle;
  global.splitTargetNarrative = splitTargetNarrative;
})(window);
