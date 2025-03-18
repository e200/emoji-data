const fs = require('fs').promises;

function toUnified(input) {
  if (!input || typeof input !== 'string') {
    console.warn('Invalid input to toUnified:', input);
    return '';
  }

  if (input.includes('\\u')) {
    const parts = input.match(/\\u[0-9A-Fa-f]{4}/g) || [];
    if (!parts.length) {
      console.warn('No valid escaped Unicode in:', input);
      return '';
    }

    const codePoints = [];
    for (let i = 0; i < parts.length; i++) {
      const code = parseInt(parts[i].slice(2), 16);
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < parts.length) {
        const high = code;
        const low = parseInt(parts[i + 1].slice(2), 16);
        if (low >= 0xDC00 && low <= 0xDFFF) {
          const fullCode = ((high - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
          codePoints.push(fullCode.toString(16).toUpperCase());
          i++; // Skip low surrogate
        } else {
          codePoints.push(code.toString(16).toUpperCase());
        }
      } else {
        codePoints.push(code.toString(16).toUpperCase());
      }
    }
    return codePoints.join('-');
  }

  const codePoints = [];
  for (let i = 0; i < input.length;) {
    const codePoint = input.codePointAt(i);
    if (codePoint === undefined) break;
    codePoints.push(codePoint.toString(16).toUpperCase());
    i += codePoint > 0xFFFF ? 2 : 1;
  }
  return codePoints.join('-');
}

function toCapitalCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function convertEmojiData() {
  try {
    const [emojiRaw, wordsRaw] = await Promise.all([
      fs.readFile('emoji.json', 'utf8'),
      fs.readFile('words.json', 'utf8')
    ]);
    const emojiData = JSON.parse(emojiRaw);
    const wordsData = JSON.parse(wordsRaw);

    const wordsMap = new Map();
    wordsData.forEach((wordEntry) => {
      const unified = toUnified(wordEntry.e);
      if (unified) {
        const keywords = (wordEntry.k || '').trim();
        if (keywords) {
          wordsMap.set(unified, keywords);
        }
      }
    });

    const convertedData = emojiData.map((emojiEntry) => {
      const unified = emojiEntry.unified;
      const keywords = wordsMap.get(unified);
      const name = toCapitalCase(emojiEntry.name);
      if (keywords) {
        return { ...emojiEntry, name, keywords: keywords.split(' ') };
      }
      return { ...emojiEntry, name };
    });

    convertedData.sort((a, b) => {
      const orderA = a.sort_order !== undefined ? a.sort_order : Infinity;
      const orderB = b.sort_order !== undefined ? b.sort_order : Infinity;
      return orderA - orderB;
    });

    await fs.writeFile(
      'emojis_with_keywords.json',
      JSON.stringify(convertedData, null, 2),
      'utf8'
    );

    console.log('Converted file created: emojis_with_keywords.json');
    console.log('Total entries in emoji.json:', emojiData.length);
    console.log('Entries with keywords added:', convertedData.filter(e => e.keywords).length);
  } catch (error) {
    console.error('Error during conversion:', error);
    throw error;
  }
}

convertEmojiData().catch(err => console.error('Execution failed:', err));
