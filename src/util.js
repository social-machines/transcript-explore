import * as d3 from 'd3';
import stopwords from './stopwords.json';
import globalData from './globalData';

// create a map of stopwords for O(1) lookups
const stopwordMap = d3
  .nest()
  .key(d => d)
  .rollup(() => true)
  .object(stopwords.map(d => d.toLowerCase()));

/**
 * helper to render a word, denormalizing if available
 */
export function renderWord(word) {
  return globalData.wordDenorm[word.string] || word.string;
}

/**
 * Convert words from TSV format "word\tstart\tend" to normalized JSON format
 */
function normalizeWordsFromTsv(tsv) {
  const words = d3.tsvParseRows(tsv, (d, i) => ({
    string: d[0],
    normalizedString: d[0]
      .replace(/([^A-Za-z0-9@_\-#'" ])+/g, '')
      .toLowerCase(),
    time: +d[1],
    endTime: +d[2],
    stopword: stopwordMap[d[0].toLowerCase()] != null,
  }));

  return words;
}

/**
 * Convert words from JSON format [word, start, end, confidence] to normalized JSON format
 */
function normalizeWordsFromJson(json) {
  const words = json.words.map(word => ({
    string: word[0],
    normalizedString: word[0]
      .replace(/([^A-Za-z0-9@_\-#'" ])+/g, '')
      .toLowerCase(),
    time: word[1],
    endTime: word[2],
    confidence: word[3],
    stopWord: stopwordMap[word[0].toLowerCase()] != null,
  }));
  return words;
}

/**
 * Given a list of normalized words, process the rest of the transcript segments
 * and other metadata.
 */
function processTranscript(words, diarization) {
  addConcordance(words);
  let segments;
  if (diarization) {
    console.log('got diarization', diarization);
    segments = computeSegmentsFromDiarization(words, diarization);
  } else {
    segments = discoverSegmentsFromWords(words);
  }

  const transcript = {
    words,
    segments,
    duration: words[words.length - 1].endTime,
  };

  return transcript;
}

/**
 * Converts a TSV file with word, start time, end time into segments
 * and words.
 */
export function readTranscriptFromTsv(tsv) {
  return processTranscript(normalizeWordsFromTsv(tsv));
}

/**
 * Converts a transcript JSON file to the expected transcript format.
 */
export function readTranscriptFromJson(json) {
  return processTranscript(normalizeWordsFromJson(json), json.diarization);
}

/**
 * Looks for gaps in end times of words to compute where segments should be split
 */
function discoverSegmentsFromWords(words) {
  const segments = [];
  let currSegment = {
    words: [words[0]],
    time: words[0].time,
    endTime: words[0].endTime,
  };

  // amount of seconds before a new segment is defined
  const segmentThreshold = 1.2;

  for (let i = 1; i < words.length; ++i) {
    const word = words[i];
    const lastWord = words[i - 1];
    if (word.endTime - lastWord.endTime > segmentThreshold) {
      // end current segment
      segments.push(currSegment);
      currSegment = {
        words: [],
        time: word.time,
      };
    }

    // add to segment
    currSegment.words.push(word);
    currSegment.endTime = word.endTime;
  }

  segments.push(currSegment);

  return segments;
}

function computeSegmentsFromDiarization(words, diarization) {
  // convert from spkr_label SXX to numbers 0, ... num speakers
  let lastSpeakerId = 0;
  const speakerIdMap = {};

  diarization.sort((a, b) => a.start_seconds - b.start_seconds);
  const segments = diarization.map(d => {
    // get ID from label
    let speakerId = speakerIdMap[d.spkr_label];
    if (!speakerId) {
      lastSpeakerId += 1;
      speakerId = lastSpeakerId;
      speakerIdMap[d.spkr_label] = speakerId;
    }

    const segment = {
      time: d.start_seconds,
      endTime: d.end_seconds,
      speakerInfo: {
        gender: d.gender,
        id: speakerId,
        envType: d.env_type,
      },
    };

    segment.words = words.filter(
      word => word.time >= segment.time && word.time <= segment.endTime
    );

    return segment;
  });

  return segments;
}

/**
 * Given a list of words, create concordance previews around each
 */
function addConcordance(words) {
  const numWords = 5; // before and after
  const numBefore = numWords;
  const numAfter = numWords;

  words.forEach((word, i) => {
    let beforeWordIndex = Math.max(0, i - numBefore);
    let afterWordIndex = Math.min(i + 1, words.length - 1);
    let beforeWords = [];
    let afterWords = [];

    while (beforeWordIndex < i) {
      beforeWords.push(renderWord(words[beforeWordIndex]));
      beforeWordIndex += 1;
    }

    while (
      afterWordIndex > i &&
      afterWordIndex <= Math.min(i + numAfter, words.length - 1)
    ) {
      afterWords.push(renderWord(words[afterWordIndex]));
      afterWordIndex += 1;
    }

    word.concordance = {
      before: beforeWords,
      after: afterWords,
      string: [...beforeWords, renderWord(word), ...afterWords].join(' '),
    };
  });

  return words;
}

export function leftPad(num) {
  if (num < 10) {
    return `0${num}`;
  }

  return `${num}`;
}

export function formatTime(time) {
  const hours = Math.floor(time / (60 * 60));
  const minutes = Math.floor((time % (60 * 60)) / 60);
  const seconds = Math.floor(time % 60);

  const parts = [minutes, seconds];
  if (hours > 0) {
    parts.unshift(hours);
  }

  // don't leftpad biggest number
  return parts.map((d, i) => (i > 0 ? leftPad(d) : d)).join(':');
}

/**
 * Takes a transcript and produces the top terms with links to all occurrences
 */
export function topTermsFromTranscript(transcript, filterStopWords, limit) {
  console.log('got transcript =', transcript);
  let wordsToUse = transcript.words;

  // filter out stop words if required
  if (filterStopWords) {
    wordsToUse = wordsToUse.filter(
      d =>
        !d.stopword &&
        d.string.length > 2 &&
        d.string !== '<unk>' &&
        d.string !== '[noise]'
    );
  }

  const terms = d3
    .nest()
    .key(d => d.normalizedString)
    .entries(wordsToUse);
  // .sort((a, b) => b.values.length - a.values.length);

  // mark as stopwords, compute freq scoreusing unigramcount
  terms.forEach(term => {
    term.stopword = term.values[0].stopword;
    term.unigramCount =
      globalData.unigramCounts[term.key] || globalData.unigramCounts.__default;
    term.freqScore = term.values.length / term.unigramCount;
  });

  terms.sort((a, b) => b.freqScore - a.freqScore);

  let filteredTerms = terms;

  // filter out stop words if required
  if (filterStopWords) {
    filteredTerms = filteredTerms.filter(
      d =>
        !d.stopword &&
        d.key.length > 2 &&
        d.key !== '<unk>' &&
        d.key !== '[noise]'
    );
  }

  // truncate if required
  if (limit) {
    filteredTerms = filteredTerms.slice(0, limit);
  }

  // re-sort by frequency
  filteredTerms.sort((a, b) => b.values.length - a.values.length);

  // remove punctuation from keys
  filteredTerms.forEach(term => {
    // use first value to try and maintain capitalization
    if (term.values[0].string.includes('._')) {
      // handle initialisms specially
      term.key = term.values[0].string.replace(/[\\._]+/g, '').toUpperCase();
    } else {
      term.key = term.values[0].string.replace(/([^A-Za-z0-9@_\-#'" ])+/g, '');
    }
  });

  return filteredTerms;
}

/**
 * Finds the actual end time for when a speaker stops talking (collapses multiple of the same speaker in a row into one end time)
 */
export function getSpeakerEndTime(segments, segmentIndex) {
  // get the initial segment's speaker ID
  const initialSegment = segments[segmentIndex];
  const { speakerInfo: initialSpeakerInfo } = initialSegment;

  if (initialSpeakerInfo) {
    const { id: initialSpeakerId } = initialSpeakerInfo;
    // iterate to see how many more segments this speaker speaks for
    for (let i = segmentIndex; i < segments.length - 1; i++) {
      const nextSegment = segments[i + 1];
      // if a new speaker appears, return this segment's end time
      if (
        !nextSegment.speakerInfo ||
        nextSegment.speakerInfo.id !== initialSpeakerId
      ) {
        return segments[i].endTime;
      }
    }
  }
  // if there is no speaker info or it's the last clip, just return this segment's time
  return initialSegment.endTime;
}
