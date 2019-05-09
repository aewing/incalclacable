import React, { Component } from "react";
import injectSheet from "react-jss";
import JSML from "../lib/jsml";

const editorTextStyles = {
  fontFamily: "sans-serif",
  fontSize: "12px",
  lineHeight: "18px"
};

const styles = theme => ({
  container: {
    margin: "10px",
    width: "calc(100vw - 20px)",
    borderRadius: "4px",
    padding: "4px"
  },
  editor: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 1,
    background: "transparent",
    width: "70vw",
    height: "calc(100vh - 20px)",
    border: "none",
    padding: "10px",
    margin: 0,
    resize: "none",
    color: "rgba(0, 0, 0, 0)",
    caretColor: "#000",
    outline: "none",
    ...editorTextStyles
  },
  overlay: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "calc(100vw - 20px)",
    height: "calc(100vh - 20px)",
    padding: "10px",
    ...editorTextStyles
  },
  row: {
    minHeight: "18px",
    width: "100%",
    borderBottom: "1px solid #ccc",
    lineHeight: "18px"
  },
  lines: {
    display: "table"
  },
  line: {
    width: "70vw",
    display: "inline-block"
  },
  output: {
    width: "calc(30vw - 94px)",
    marginLeft: "64px",
    textAlign: "center",
    display: "inline-block",
    verticalAlign: "top",
    color: "#ff0000"
  }
});

const styled = injectSheet(styles);

const styledEl = (Component, className) =>
  styled(({ classes, children, theme, ...rest }) => (
    <Component className={classes[className]} {...rest}>
      {children}
    </Component>
  ));

const styledDiv = className =>
  styledEl(({ theme, ...props }) => <div {...props} />, className);

const Container = styledDiv("container");

const Editor = styledEl(props => <textarea {...props} />, "editor");

const Overlay = styledDiv("overlay");
const Row = styledDiv("row");
const Lines = styledDiv("lines");
const LineContainer = styledDiv("line");
const Output = styledDiv("output");

const colorSpan = color => content =>
  `<span style="color:${color};">${content}</span>`;
const fnTag = colorSpan("blue");
const paramTag = colorSpan("gray");
const varTag = colorSpan("orange");
const numTag = colorSpan("green");
const valTag = colorSpan("red");
const pathTag = colorSpan("#2211aa");
const dataTag = colorSpan("purple");

const urlTag = (url, data = "") =>
  pathTag(url) + (data ? `:${dataTag(data)}` : "");

const Line = ({ text }) => {
  let html = text;

  // Syntax highlighting

  // Function highlighting
  html = html.replace(/@([^\(]+)\(([^\)]+)\)/g, (match, fn, paramStr) => {
    return fnTag(`@${fn}(${paramTag(paramStr)})`);
  });

  // Variable highlighting
  html = html.replace(/([^=]+) = /g, (match, variable) => {
    return `${varTag(variable)} = `;
  });

  // Number highlighting
  html = html.replace(/ ([0-9]+)/g, match => numTag(match));

  // URL highlighting
  html = html.replace(
    / = \(([^\)]+)\):?(.*)?/g,
    (match, url, data) => `<span> = </span>(${urlTag(url, data)})`
  );

  // Value highlighting
  html = html.replace(/ = ([^<]+)/g, (match, val) => ` = ${valTag(val)}`);

  return <LineContainer dangerouslySetInnerHTML={{ __html: html }} />;
};

export default class Calculator extends Component {
  state = {
    raw: "",
    input: [],
    output: [],
    meta: [],
    assignments: {}
  };

  constructor(props) {
    super(props);
    this.state.raw = props.initialValue
      ? props.initialValue
          .trim()
          .replace(/ /g, "")
          .replace(/[=*+^-]/g, " = ")
      : "";
    this.state.input = this.state.raw.split("\n");

    this.setValue(this.state.raw);
  }

  setValue = (raw = "") => {
    const input = raw ? raw.split("\n") : [];
    if (this.state.raw !== raw) {
      this.setState({
        raw,
        input
      });
    }

    JSML.parse(input).then(([output, meta, assignments]) => {
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

  parse = () => {
    return this.onChange({ currentTarget: { value: this.state.raw } });
  };

  componentDidMount() {
    this.mouseUpListener = document.addEventListener("mouseup", e => {
      JSML.setState({
        clickX: e.clientX,
        clickY: e.clientY
      });

      Object.keys(JSML.stateCache).forEach(key => {
        if (key.includes("clickX") || key.includes("clickY")) {
          delete JSML.stateCache[key];
        }
      });

      return this.parse();
    });
  }

  componentWillUnmount() {
    document.removeEventListener("mouseup", this.mouseUpListener);
  }

  render() {
    const { raw, input, output, meta, assignments } = this.state;

    return (
      <Container>
        <Editor
          value={raw}
          onChange={this.onChange}
          autoCapitalize="false"
          spellCheck="false"
        />
        <Overlay>
          <Lines>
            {input.map((line, index) => (
              <Row key={index}>
                <Line text={line} action={meta[index]} />
                <Output>{output[index]}</Output>
              </Row>
            ))}
          </Lines>
        </Overlay>
      </Container>
    );
  }
}
