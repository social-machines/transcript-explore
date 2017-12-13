import React, { Component } from 'react';
import { Container, Row, Col } from 'reactstrap';
import ReactAudioPlayer from 'react-audio-player';

import { Navbar, NavbarBrand, Nav, NavItem } from 'reactstrap';
import { readTranscriptFromTsv } from './util';
import FullTranscript from './components/FullTranscript';
import TranscriptTopTerms from './components/TranscriptTopTerms';

import './App.css';

class App extends Component {
  state = {
    tsvFileContents: null,
    tsvFilename: null,
    transcript: null,
    soundFileContents: null,
    soundFilename: null,
  };

  handleTsvChange = evt => {
    const file = evt.target.files[0];
    console.log('got tsv file', file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.setState({
          tsvFileContents: reader.result,
          tsvFilename: file,
          transcript: readTranscriptFromTsv(reader.result),
        });
      };

      reader.readAsText(file);
    }
  };

  handleSoundChange = evt => {
    const file = evt.target.files[0];
    console.log('got sound file', file);
    // NOTE: using FileReader here breaks seeking and is heavy on memory usage
    this.setState({
      soundFilename: file,
      soundFileContents: URL.createObjectURL(file),
    });
  };

  /**
   * Jump to and play a particular part of the sound
   */
  handleSeekAudio = seconds => {
    if (this.audioPlayer && this.audioPlayer.audioEl) {
      console.log('seeking to', seconds);
      this.audioPlayer.audioEl.play();
      this.audioPlayer.audioEl.currentTime = seconds;
    }
  };

  handleSeekToWord = word => {
    this.handleSeekAudio(word.time);
  };

  renderFileInputs() {
    return (
      <div className="mb-4">
        <Row>
          <Col sm="6" className="upload-box">
            <h4>Upload a transcript TSV</h4>
            <input type="file" onChange={this.handleTsvChange} />
          </Col>
          <Col sm="6" className="upload-box">
            <h4>Upload a sound file</h4>
            <input type="file" onChange={this.handleSoundChange} />
          </Col>
        </Row>
      </div>
    );
  }

  renderTranscript() {
    const { transcript } = this.state;

    if (!transcript) {
      return null;
    }

    return (
      <div className="text-container mb-4">
        <h5>Full Transcript</h5>

        <FullTranscript
          transcript={transcript}
          onSelectWord={this.handleSeekToWord}
        />
      </div>
    );
  }

  renderSoundPlayer() {
    const { soundFileContents } = this.state;

    return (
      <div className="sound-player-container">
        {!soundFileContents && (
          <span className="text-muted">Please upload a sound file.</span>
        )}
        {soundFileContents && (
          <ReactAudioPlayer
            src={soundFileContents}
            controls
            ref={node => (window.ap = this.audioPlayer = node)}
          />
        )}
      </div>
    );
  }

  renderNav() {
    return (
      <Navbar className="main-nav" color="dark" expand="md" fixed="top">
        <Container>
          <NavbarBrand tag="span" className="mr-4">
            Transcript Explorer
          </NavbarBrand>
          <Nav navbar>
            <NavItem>{this.renderSoundPlayer()}</NavItem>
          </Nav>
        </Container>
      </Navbar>
    );
  }

  renderTopTerms() {
    const { transcript } = this.state;

    if (!transcript) {
      return null;
    }

    return (
      <div className="mb-4">
        <h5>Top Terms</h5>
        <TranscriptTopTerms
          transcript={transcript}
          onSeekTime={this.handleSeekAudio}
        />
      </div>
    );
  }

  render() {
    return (
      <div className="App">
        {this.renderNav()}
        <Container>
          {this.renderFileInputs()}
          {this.renderTopTerms()}
          {this.renderTranscript()}
        </Container>
      </div>
    );
  }
}

export default App;
