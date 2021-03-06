import React, { Component } from 'react';
import cx from 'classnames';
import { scaleOrdinal, scaleLinear } from 'd3';

import { formatTime, renderWord, getSpeakerEndTime } from '../util';

import './FullTranscript.css';

const femaleColorScale = scaleOrdinal().range([
  '#DF5144',
  '#BA3843',
  '#771734',
  '#4D0B31',
]);
const maleColorScale = scaleOrdinal().range([
  '#488AA8',
  '#2D6CA6',
  '#314DA0',
  '#1E367F',
]);

class FullTranscript extends Component {
  render() {
    const { transcript, onSelectWord } = this.props;

    if (transcript == null) {
      return null;
    }

    return (
      <div className="FullTranscript">
        {transcript.segments.map((segment, i, allSegments) => (
          <TranscriptSegment
            key={i}
            segment={segment}
            onSelectWord={onSelectWord}
            previousSegment={allSegments[i - 1]}
            endTime={getSpeakerEndTime(allSegments, i)}
          />
        ))}
      </div>
    );
  }
}

class TranscriptSegment extends Component {
  render() {
    const { segment, onSelectWord, previousSegment, endTime } = this.props;
    const { speakerInfo } = segment;

    let isPrevSpeaker = false;
    let color;
    if (speakerInfo) {
      isPrevSpeaker =
        previousSegment && previousSegment.speakerInfo.id === speakerInfo.id;
      color =
        speakerInfo.gender === 'M'
          ? maleColorScale(speakerInfo.id)
          : femaleColorScale(speakerInfo.id);
    }
    const showSpeaker = !isPrevSpeaker && speakerInfo;

    return (
      <div className="TranscriptSegment">
        <div className="segment-header">
          {showSpeaker && (
            <React.Fragment>
              <span
                className={cx('segment-speaker-avatar', {
                  'male-speaker': speakerInfo.gender === 'M',
                  'female-speaker': speakerInfo.gender === 'F',
                })}
                style={{ backgroundColor: color }}
              >
                S{speakerInfo.id}
              </span>
              <span
                className={cx('segment-speaker', {
                  'male-speaker': speakerInfo.gender === 'M',
                  'female-speaker': speakerInfo.gender === 'F',
                })}
              >
                Speaker {speakerInfo.id}
              </span>
            </React.Fragment>
          )}
          {!isPrevSpeaker && (
            <span className="segment-time">
              {formatTime(segment.time)}–{formatTime(endTime)}
            </span>
          )}
        </div>
        {segment.words.map((word, i) => [
          <React.Fragment key={i}>
            <TranscriptWord word={word} onClick={onSelectWord} />{' '}
          </React.Fragment>,
        ])}
      </div>
    );
  }
}

class TranscriptWord extends Component {
  static defaultProps = {
    showConfidence: true,
  };
  handleClick = () => {
    this.props.onClick(this.props.word);
  };

  render() {
    const { word, showConfidence } = this.props;
    const opacity = showConfidence
      ? scaleLinear()
          .domain([0.6, 1.0])
          .range([0.6, 1.0])
          .clamp(true)(word.confidence)
      : 1;

    return (
      <span
        title={`Confidence: ${word.confidence}`}
        className={cx('TranscriptWord')}
        onClick={this.handleClick}
        style={{ opacity }}
      >
        {renderWord(word)}
      </span>
    );
  }
}

export default FullTranscript;
