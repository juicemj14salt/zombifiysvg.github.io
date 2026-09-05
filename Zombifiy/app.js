let originalSVG = null;
let convertedSVG = null;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const originalPreview = document.getElementById('originalPreview');
const zombiePreview = document.getElementById('zombiePreview');
const infoBox = document.getElementById('infoBox');

const presets = {
  toxic:    { h: 105, s: 100, baseL: 55 },
  swamp:    { h: 135, s: 35,  baseL: 40 },
  neon:     { h: 90,  s: 100, baseL: 60 },
  military: { h: 80,  s: 40,  baseL: 30 },
  acid:     { h: 75,  s: 100, baseL: 65 }
};

/* ---------- Event Listeners ---------- */

dropZone.addEventListener('click', () => {
  fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith('.svg')) {
    handleFile(file);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

convertBtn.addEventListener('click', doConvert);

document.getElementById('depthSlider').addEventListener('input', function() {
  document.getElementById('depthVal').textContent = this.value + '%';
  if (originalSVG) doConvert();
});

document.getElementById('contrastSlider').addEventListener('input', function() {
  document.getElementById('contrastVal').textContent = this.value + '%';
  if (originalSVG) doConvert();
});

document.getElementById('greenPreset').addEventListener('change', () => {
  if (originalSVG) doConvert();
});

document.getElementById('scratchMode').addEventListener('change', () => {
  if (originalSVG) doConvert();
});

downloadBtn.addEventListener('click', () => {
  if (!convertedSVG) return;
  const blob = new Blob([convertedSVG], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'zombie_' + (fileInput.files[0]?.name || 'converted.svg');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

copyBtn.addEventListener('click', () => {
  if (!convertedSVG) return;
  navigator.clipboard.writeText(convertedSVG).then(() => {
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => copyBtn.textContent = '📋 Copy SVG Code', 2000);
  }).catch(() => {
    copyBtn.textContent = '❌ Failed';
    setTimeout(() => copyBtn.textContent = '📋 Copy SVG Code', 2000);
  });
});

/* ---------- Core Logic ---------- */

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    originalSVG = e.target.result;
    originalPreview.innerHTML = originalSVG;
    convertBtn.disabled = false;
    infoBox.style.display = 'block';
    doConvert();
  };
  reader.onerror = () => {
    alert('Failed to read the SVG file.');
  };
  reader.readAsText(file);
}

function getLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16)
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x =>
    Math.round(Math.max(0, Math.min(255, x)))
      .toString(16)
      .padStart(2, '0')
  ).join('');
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

function getZombieColor(originalColor, depth, contrast, preset) {
  let rgb = null;

  if (originalColor.startsWith('#')) {
    rgb = hexToRgb(originalColor);
  } else if (originalColor.startsWith('rgb')) {
    const m = originalColor.match(/\d+/g);
    if (m) rgb = { r: +m[0], g: +m[1], b: +m[2] };
  }

  if (!rgb) return '#39ff14';

  const lum = getLuminance(rgb.r, rgb.g, rgb.b);
  const normLum = lum / 255;

  const p = presets[preset];
  const depthFactor = depth / 100;
  const contrastFactor = contrast / 100;

  let targetL = p.baseL + (normLum - 0.5) * 40 * contrastFactor;
  targetL -= (1 - normLum) * 30 * depthFactor;
  targetL = Math.max(10, Math.min(90, targetL));

  const newRgb = hslToRgb(p.h, p.s, targetL);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

function processElement(el, depth, contrast, preset, scratchMode) {
  const attrs = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'];

  attrs.forEach(attr => {
    const val = el.getAttribute(attr);
    if (val && val !== 'none' && !val.startsWith('url(')) {
      const newColor = getZombieColor(val, depth, contrast, preset);
      el.setAttribute(attr, newColor);
    }
  });

  if (scratchMode === 'strict') {
    const style = el.getAttribute('style');
    if (style) {
      let newStyle = style;
      attrs.forEach(attr => {
        const regex = new RegExp(attr + '\\s*:\\s*([^;]+)', 'gi');
        newStyle = newStyle.replace(regex, (match, color) => {
          const c = color.trim();
          if (c === 'none' || c.startsWith('url(')) return match;
          return attr + ':' + getZombieColor(c, depth, contrast, preset);
        });
      });
      el.setAttribute('style', newStyle);
    }
  }
}

function makeScratchCompatible(svgText, scratchMode) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return svgText;

  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  if (scratchMode === 'strict') {
    const styleTags = svg.querySelectorAll('style');
    styleTags.forEach(st => {
      const css = st.textContent;
      const rules = css.match(/[^{]+\{[^}]+\}/g) || [];
      rules.forEach(rule => {
        const splitIdx = rule.indexOf('{');
        const sel = rule.slice(0, splitIdx).trim();
        const decl = rule.slice(splitIdx + 1).replace('}', '').trim();
        try {
          const els = svg.querySelectorAll(sel);
          els.forEach(el => {
            const current = el.getAttribute('style') || '';
            el.setAttribute('style', current + (current ? ';' : '') + decl);
          });
        } catch (e) {
          // Invalid selector, skip
        }
      });
      st.remove();
    });

    const unsupported = svg.querySelectorAll(
      'script, foreignObject, use, animate, animateTransform, animateMotion'
    );
    unsupported.forEach(el => el.remove());

    const allEls = svg.querySelectorAll('*');
    allEls.forEach(el => el.removeAttribute('class'));
  }

  return new XMLSerializer().serializeToString(svg);
}

function doConvert() {
  if (!originalSVG) return;

  const depth = +document.getElementById('depthSlider').value;
  const contrast = +document.getElementById('contrastSlider').value;
  const preset = document.getElementById('greenPreset').value;
  const scratchMode = document.getElementById('scratchMode').value;

  const parser = new DOMParser();
  const doc = parser.parseFromString(originalSVG, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return;

  const allElements = svg.querySelectorAll('*');
  allElements.forEach(el => processElement(el, depth, contrast, preset, scratchMode));

  let result = new XMLSerializer().serializeToString(svg);
  result = makeScratchCompatible(result, scratchMode);

  convertedSVG = result;
  zombiePreview.innerHTML = result;
  downloadBtn.disabled = false;
  copyBtn.disabled = false;
}