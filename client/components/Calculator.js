import React, { Component } from "react";
import injectSheet from "react-jss";
import JSML from "../lib/jsml";

const editorTextStyles = {
  fontFamily: "sans-serif",
  fontSize: "12px",
  lineHeight: "18px",
  '@media (min-width: 620px)': {
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
};

const editorWidthStyles = {
  width: 'calc(100vw - 40px)',
  '@media (min-width: 620px)': {
    width: "70vw"
  }
};

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
    position: "absolute",
    left: "10px",
    top: "10px",
    ...editorWidthStyles,
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
    ...editorTextStyles
  },
  overlay: {
    position: "absolute",
    left: "10px",
    top: "10px",
    width: "calc(100vw - 40px)",
    height: "calc(100vh - 40px)",
    padding: "10px",
    ...editorTextStyles
  },
  row: {
    minHeight: "18px",
    width: "100%"
  },
  lines: {
    display: "table"
  },
  line: {
    ...editorWidthStyles,
    display: "inline-block",
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
    '@media (min-width: 520px)': {
      width: "calc(30vw - 65px)",
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
