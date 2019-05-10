import React, { Component } from "react";
import injectSheet from "react-jss";
import JSML from "../lib/jsml";

const editorStyles = forEditor => ({
  fontFamily: "sans-serif",
  fontSize: "12px",
  lineHeight: forEditor ? "36px" : "18px",
  width: 'calc(100vw - 40px)',
  '@media (min-width: 620px)': {
    width: "70vw",
    fontFamily: "sans-serif",
    fontSize: "16px",
    lineHeight: "22px",
    textAlign: "left"
  },
  '@media (min-width: 1024px)': {
    fontFamily: "sans-serif",
    fontSize: "24px",
    lineHeight: "28px"
  }
});

const styles = theme => ({
  container: {
    margin: "10px",
    width: "calc(100vw - 32px)",
    height: "calc(100vh - 32px)",
    borderRadius: "4px",
    border: "1px solid #111",
    background: "#222",
    boxShadow: "0 2px 2px rgba(0, 0, 0, 0.15)",
    color: "#eee",
    padding: "4px",
    cursor: "text"
  },
  editor: {
    appearance: "none",
    position: "absolute",
    left: "10px",
    top: "10px",
    height: "calc(100vh - 40px)",
    zIndex: 1,
    background: "transparent",
    border: "none",
    padding: "10px",
    margin: 0,
    resize: "none",
    color: "rgba(0, 0, 0, 0)",
    caretColor: "#fff",
    outline: "none",
    ...editorStyles(true),
  },
  overlay: {
    position: "absolute",
    left: "10px",
    top: "10px",
    width: "calc(100vw - 40px)",
    height: "calc(100vh - 40px)",
    padding: "10px"
  },
  row: {
    minHeight: "18px",
    width: "100%"
  },
  lines: {
    display: "table"
  },
  line: {
    ...editorStyles(false),
    display: "inline-block",
    wordWrap: "break-word",
    "& span.function": {
      color: "rgb(200, 180, 225)"
    },
    "& span.param": {
      color: "rgb(235, 235, 235)"
    },
    "& span.variable": {
      color: "rgb(105, 175, 235)"
    },
    "& span.number": {
      color: "rgb(105, 195, 145)"
    },
    "& span.value": {
      color: "rgb(235, 200, 150)"
    },
    "& span.url": {
      color: "rgba(200, 200, 200, 0.9)"
    },
    "& span.data": {
      color: "rgba(200, 200, 200, 0.9)"
    },
    "& span.comment": {
      color: "rgba(200, 200, 200, 0.9)"
    }
  },
  output: {
    width: "calc(100vw - 40px)",
    '@media (min-width: 620px)': {
      width: "calc(30vw - 65px)",
      fontSize: "16px",
      lineHeight: "22px",
    },
    '@media (min-width: 1024px)': {
      fontSize: "24px",
      lineHeight: "28px"
    },
    marginLeft: "10px",
    paddingLeft: "10px",
    borderLeft: "1px solid rgba(245,245,245,0.25)",
    textAlign: "left",
    display: "inline-block",
    fontSize: "12px",
    verticalAlign: "top",
    color: "rgba(200,235,255,0.9)",
    background: "rgba(245,245,245,0.1)"
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

const tagSpan = type => content =>
  `<span class="${type}">${content}</span>`;
const fnTag = tagSpan("function");
const paramTag = tagSpan("param");
const varTag = tagSpan("variable");
const numTag = tagSpan("number");
const valTag = tagSpan("value");
const pathTag = tagSpan("url");
const dataTag = tagSpan("data");

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

  // URL highlighting
  html = html.replace(
    / = \(([^\)]+)\):?(.*)?/g,
    (match, url, data) => `<span> = </span>(${urlTag(url, data)})`
  );

  // Number highlighting
  html = html.replace(/ ([0-9]+)[ \n]/g, match => numTag(match));

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
      ? this.cleanRawInput(props.initialValue)
      : "";
    this.state.input = this.state.raw.split("\n");

    this.setValue(this.state.raw);
  }

  cleanRawInput(input, enforceSpacing=false) {
    let out = (input + "");

    if (enforceSpacing) {
      out = out.replace(/ /g, "")
        .replace(/^([a-zA-Z0-9\.\[\]]+)([\=\*\+\^\-]+)(.*)$/gm, (full, pre, ops, post) => {
          return full.replace(pre + ops + post, `${pre} ${ops} ${post}`);
        })
        .replace(/ = ([a-zA-Z0-9\.\[\]]+)([\=\*\+\^\-]+)([a-zA-Z0-9]+)/g, (full, pre, ops, post) => {
          return full.replace(pre + ops + post, `${pre} ${ops} ${post}`);
        }).split("\n").map(v => v.trim());
    } else {
      out = out.split("\n");
    }

    if (!out[0].length) {
      out.shift();
    }

    return out.join("\n");
  }

  setValue = (raw = "", state = {}, stripWhitespace=false) => {
    raw = this.cleanRawInput(raw, stripWhitespace);
    const input = raw ? raw.split("\n") : [];
    if (this.state.raw !== raw) {
      this.setState({
        raw,
        input
      });
    }

    JSML.parse(input, state).then(([output, meta, assignments]) => {
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
    this.mouseUpListener = document.addEventListener("mouseup", e => {
      // Invalidate cache for anything referencing clickX or clickY
      Object.keys(JSML.stateCacheKeys).forEach(key => {
        if (key.includes("clickX") || key.includes("clickY")) {
          delete JSML.stateCacheKeys[key];
          delete JSML.stateCache[key];
        }
      });

      return this.setValue(this.state.raw, { clientX: e.clientX, clickY: e.clientY }, true);
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
        <Overlay onClick={this.onClickOverlay}>
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
