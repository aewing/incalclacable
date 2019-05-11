import React, { Component, Fragment, createRef } from "react";
import styled, { css } from "styled-components";
import { space } from "styled-system";
import JSML from "../lib/jsml";

const editorStyles = css`
  font-family: sans-serif;
  font-size: 12px;
  line-height: 18px;
  @media (min-width: 620px) {
    font-size: 16px;
    line-height: 22px;
  }
  @media (min-width: 1024px) {
    font-size: 24px;
    line-height: 28px;
  }
`;

const Container = styled.div`
  margin: 10px;
  width: calc(100vw - 32px);
  height: calc(100vh - 32px);
  border-radius: 4px;
  border: 1px solid #111;
  background: #222;
  box-shadow: 0 2px 2px rgba(0, 0, 0, 0.15);
  color: #eee;
  padding: 4px;
  cursor: text;
`;

const Editor = styled.textarea`
  appearance: none;
  position: absolute;
  left: 10px;
  top: 10px;
  height: calc(100vh - 40px);
  z-index: 1;
  background: transparent;
  border: none;
  padding: 10px;
  margin: 0;
  resize: none;
  color: rgba(0, 0, 0, 0);
  caret-color: #fff;
  outline: none;
  padding-left: 50px;
  ${editorStyles};
  @media(max-width: 520px) {
    display: block;
    width: 100%;
    height: 50%; 
    overflow: auto;
  }
  @media(min-width: 521px) {
    width: 70%;
    float: left;
  }
`;

const Overlay = styled.div`
  position: absolute;
  left: 10px;
  top: 10px;
  width: calc(100vw - 40px);
  height: calc(100vh - 40px);
  padding: 10px;
`;


const Input = styled.div`
  @media(max-width: 520px) {
    display: block;
    width: 100%;
    height: 50%; 
    overflow: auto;
  }
  @media(min-width: 521px) {
    width: 70%;
    float: left;
  }
`;

const Output = styled.div`
  background: rgba(0, 0, 0, 0.15);
  @media(max-width: 520px) {
    display: block;
    width: calc(100% - 1px);
    height: 50%; 
    overflow: auto;
  }
  @media(min-width: 521px) {
    width: calc(30% - 1px);
    float: left;
  }
`;

const InputLine = styled.div`
  ${editorStyles};
  word-wrap: break-word;
`;

const LineNumber = styled.div`
  text-align: right;
  padding-right: 10px;
  margin-right: 10px;
  width: 19px;
  display: inline-block;
  border-right: 1px solid #ccc;
  color: #eee;
  opacity: 0.5;
`;

const OutputLine = styled.div`
  text-align: left;
  ${editorStyles};
  text-overflow: ellipsis;
  overflow: hidden;
  vertical-align: top;
  color: rgba(200,235,255,0.9);
`;

const defaultColor = [200, 200, 200, 0.9];
const syntaxColors = {
  function: [200, 180, 225, 1],
  param: [235, 235, 235, 1],
  variable: [105, 175, 235, 1],
  number: [105, 195, 145, 1],
  value: [235, 200, 150, 1],
  url: defaultColor,
  data: defaultColor,
  comment: defaultColor,
  default: defaultColor
};

const Syntax = styled.span`
  color: rgba(${props => (syntaxColors[props.type] || syntaxColors.default).join(",")}); 
`;


const urlTag = (url, data = "") =>
  pathTag(url) + (data ? `:${dataTag(data)}` : "");

const renderTags = tags => {
  return tags.map((tag, index) => {
    const value = Array.isArray(tag.value) ? renderTags(tag.value) : tag.value;
    return <Syntax key={index} type={tag.type}>{value}</Syntax>;
  })
}

const SyntaxLine = ({ text }) => {
  const tags = JSML.getTags(text);
  return <Fragment>{renderTags(tags)}</Fragment>;
};

export default class Calculator extends Component {
  state = {
    raw: "",
    baseState: {},
    input: [],
    output: [],
    meta: [],
    assignments: {}
  };

  constructor(props) {
    super(props);
    this.state.raw = props.initialValue
      ? JSML.format(props.initialValue)
      : "";
    this.state.input = this.state.raw.split("\n");
    this.inputRef = createRef(null);
    this.editorRef = createRef(null);
  }

  setValue = (raw = "", stripWhitespace=false) => {
    raw = JSML.format(raw, stripWhitespace);
    const input = raw ? raw.split("\n") : [];
    if (this.state.raw !== raw) {
      this.setState({
        raw,
        input
      });
    }

    JSML.parse(input, this.state.baseState).then(([output, meta, assignments]) => {
      this.setState({
        output,
        meta,
        assignments
      });
    });
  };

  onChange = e => {
    if (!e.currentTarget || e.currentTarget.value === "undefined") {
      return;
    }

    this.setValue(e.currentTarget.value);
  };


  componentDidMount() {
    this.mouseUpListener = document.addEventListener("mouseup", (e => {
      // Invalidate cache for anything referencing clickX or clickY
      Object.keys(JSML.stateCacheKeys).forEach(key => {
        if (key.includes("clickX") || key.includes("clickY")) {
          delete JSML.stateCacheKeys[key];
          delete JSML.stateCache[key];
        }
      });

      this.setState({
        baseState:{
          ...this.state.baseState,
          clickX: e.clientX,
          clickY: e.clientY
        }
      });
      this.setValue(this.state.raw);
    }).bind(this));

    this.mouseWheelListener = this.editorRef.current.addEventListener("scroll", e => {
      const input = this.inputRef.current;
      input.scrollTop = e.target.scrollTop;
      input.scrollLeft = e.target.scrollLeft;
    });

    this.keyPressListener = this.editorRef.current.addEventListener("keyup", e => {
      if (
        (e.code === "Space" && e.ctrlKey) 
          || ["Enter", "Tab"].includes(e.code)
          || ["(", ")"].includes(e.key)
      ) {
        this.setValue(this.state.raw, true);
      }

      if (e.code === "Tab") {
        return false;
      }
    });

    this.setValue(this.state.raw, true);
  }

  componentWillUnmount() {
    document.removeEventListener("mouseup", this.mouseUpListener);
    document.removeEventListener("scroll", this.mouseWheelListener);
    document.removeEventListener("keypress", this.keyPressListener);
  }

  render() {
    const { raw, input, output, meta, assignments } = this.state;

    return (
      <Container>
        <Editor
          ref={this.editorRef}
          value={raw}
          onChange={this.onChange}
          autoCapitalize="false"
          spellCheck="false"
        />
        <Overlay onClick={this.onClickOverlay}>
          <Input ref={this.inputRef}>
            {input.map((line, index) => (
              <InputLine key={index}>
                <LineNumber>{index + 1}</LineNumber><SyntaxLine text={line} action={meta[index]} />
              </InputLine>
            ))}
          </Input>
          <Output>
            {output.map((line, index) => (
              <OutputLine key={index}>
                <LineNumber>{index + 1}</LineNumber>{line}
              </OutputLine>
            ))}
          </Output>
        </Overlay>
      </Container>
    );
  }
}
