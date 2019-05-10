const mjs = require("mathjs");
const http = require("axios");
const get = require("lodash.get");

const SINGLE_PARAM_METHODS = [
  "round",
  "ceil",
  "floor",
  "sin",
  "cos",
  "abs",
  "sqrt"
];
const ARRAY_PARAM_METHODS = ["min", "max", "sum", "avg", "mean", "mode"];
const ASSIGNMENT_OPERATORS = {
  equality: ' = ',
  subtraction: ' -= ',
  addition: ' += ',
  multiplication: ' *= ',
  division: ' /= '
};

const JSML = {
  cache: {},
  stateCacheKeys: {},
  stateCache: {},
  taggedMarkup: (text) => {
    let tags = (JSML.format(text) + "").replace(/\[\[/g, "[").replace(/\]\]/g, "]").replace(/::/g, ":");
    // Function highlighting
    tags = tags.replace(/@([^\(]+)\(([^\)]+)\)/g, (match, fn, paramStr) => {
      return `[[function::@${fn.trim()}(${paramStr.split(',').map(param => `[[param::${param}]]`).join(',').trim()})]]`;
    });

    // Variable highlighting
    tags = tags.replace(/([^=]+) ([\=\+\*\-\\]+) /g, (match, variable, ops) => {
      return `[[variable::${variable.trim()}]] [[operator::${ops.trim()}]] `;
    });

    // URL highlighting
    tags = tags.replace(
      / ([\=\+\-\*\\]+) \(([^\)]+)\):?(.*)?/g,
      (match, ops, url, data) => `[[operator::${ops}]] ([[url::${url.trim()}::${data.trim()}]])`
    );

    // Number highlighting
    tags = tags.replace(/([ \n])([0-9]+)([ \n])/g, (match, pre, num, post) => `${pre}[[number::${num.trim()}]]${post}`);

    // Value highlighting
    tags = tags.replace(/(\[\[operator::.*\]\]) ([^<]+)/g, (match, op, val) => `${op} [[value::${val.trim()}]]`);

    return tags;
  },
  getTags: text => {
    const markup = JSML.taggedMarkup(text);
    return JSML.parseTaggedMarkup(markup, true);
  },
  parseTaggedMarkup: (text, recursively = false) => {
    const state = {
      seeking: true,
      what: 'text',
      buffer: '',
      type: false,
      innerTagSkip: 0,
      hasInnerTag: false,
      index: 0
    };

    const output = [];

    while (state.seeking && state.index < text.length) {
      const char = text[state.index];
      if (!char) {
        state.seeking = false;
      }

      if (state.what === 'text') {
        if (char === '[') {
          state.what = 'type';
          if (state.buffer.length) {
            output.push({ type: "text", value: state.buffer + '' });
            state.buffer = '';
          }
        } else {
          state.buffer += char;
        }
      }

      if (state.what === 'type') {
        if (char === '[') {
          // Ignore opening bracket and skip an index
          state.index++;
        } else if (char === ':' && text[state.index + 1] === ':') {
          // We have a variable name
          state.what = 'def';
          state.type = state.buffer + '';
          state.buffer = '';
          // Skip an index
          state.index++;
        } else {
          state.buffer += char;
        }
      } else if (state.what === 'def') {
        if (char === ':') {
          if (state.buffer === '') {
            // Ignore opening colon and skip an index
            state.index++;
          } else {
            state.buffer += char;
          }
        } else if (char === ']') {
          if (state.innerTagSkip) {
            state.buffer += char;
            state.innerTagSkip--;
          } else {
            // We have a completed definition

            let def = null;
            if (state.hasInnerTag && recursively) {
              // Parse definition recursively
              def = JSML.parseTaggedMarkup(state.buffer, true)
            } else {
              def = state.buffer;
            }

            output.push({
              type: state.type,
              value: def
            });

            // Reset state
            Object.assign(state, {
              what: 'text',
              buffer: '',
              type: false,
              innerTagSkip: 0,
              hasInnerTag: false
            });

            // Skip the next bracket
            state.index++;
          }
        } else if (char === '[') {
          state.hasInnerTag = true;
          state.innerTagSkip++;
          state.buffer += char;
        } else {
          state.buffer += char;
        }
      }

      state.index++;
    }

    if (state.buffer) {
      output.push({ type: "text", value: state.buffer });
    }

    return output;
  },
  format: (text, enforceSpacing = false) => {
    let out = (text + "");

    if (enforceSpacing) {
      out = out.replace(/ /g, "")
        .replace(/^([a-zA-Z0-9\.\[\]]+)([\=\*\+\^\-]+)(.*)$/gm, (full, pre, ops, post) => {
          return full.replace(full, `${pre} ${ops} ${post}`);
        })
        .replace(/ = ([a-zA-Z0-9\.\[\]]+)([\=\*\+\^\-]+)([a-zA-Z0-9]+)/g, (full, pre, ops, post) => {
          return full.replace(full, `${pre} ${ops} ${post}`);
        }).split("\n").map(v => v.trim());
    } else {
      out = out.split("\n");
    }

    if (!out[0].length) {
      out.shift();
    }

    return out.join("\n");
  },
  parse: async (script, state = {}) => {
    const meta = [];
    const output = [];

    const lines = JSML.flatten(script);

    state = { clickX: 0, clickY: 0, ...state };

    for (let index in lines) {
      let line = lines[index];
      if (typeof line === "function") {
        try {
          line = line(state);
        } catch (e) {}
      }

      line = JSML.parseFunctions(line, state);

      let assignmentType = false;
      if (line.match(/([a-zA-Z0-9]+) \= (.*)/g)) {
        assignmentType = "equality";
      } else if (line.match(/([a-zA-Z0-9]+) \-\= (.*)/g)) {
        assignmentType = "subtraction";
      } else if(line.match(/([a-zA-Z0-9]+) \+\= (.*)/g)) {
        assignmentType = "addition";
      } else if(line.match(/([a-zA-Z0-9]+) \*\= (.*)/g)) {
        assignmentType = "multiplication";
      } else if(line.match(/([a-zA-Z0-9]+) \\= (.*)/g)) {
        assignmentType = "division";
      }

      if (line.indexOf("--") === 0) {
        // This is a comment, so we do nothing.
      } else if (assignmentType) {
        const operator = ASSIGNMENT_OPERATORS[assignmentType];
        let [assigned, ...parts] = line.split(operator);
        assigned = assigned.trim();
        let assignment = parts.join(operator).trim();

        if (!JSML.stateCacheKeys[index] || JSML.stateCacheKeys[index] !== assignment) {
          JSML.stateCacheKeys[index] = `${assignment}`;

          if (assignmentType === "equality" && assignment.indexOf("(") === 0) {
            const matches = assignment.match(
              /\((http|https):\/\/([^:]+):?([A-Za-z]+)?\):?(.*)?/i
            );

            if (matches) {
              const [full, protocol, path, method = "GET", data = {}] = matches;
              const url = `${protocol}://${path}`;
              const cacheKey = `${method}.${url}.${JSON.stringify(data)}`;

              if (JSML.cache[cacheKey]) {
                assignment = JSML.cache[cacheKey];
              } else {
                assignment = await http
                  .request({
                    url,
                    method,
                    data
                  })
                  .then(res => {
                    return res.data;
                  })
                  .catch(err => err.message);
                JSML.cache[cacheKey] = assignment;
              }
            } else {
              assignment = false;
            }
          }

          try {
            // TODO: replace instead of split to catch unspaced operators
            let value = line
              .split(" ")
              .map(v => get(state, v.trim(), v))
              .join(" ");
            assignment = mjs.eval(value, state);
          } catch (e) {
            console.info(e);
          }

          if (assignmentType === "equality") {
            state[assigned] = assignment;
          } else {
            try {
              if (assignmentType === "subtraction") {
                state[assigned] -= assignment;
              } else if (assignmentType === "addition") {
                state[assigned] += assignment;
              } else if (assignmentType === "multiplication") {
                state[assigned] *= assignment;
              } else if (assignmentType === "division") {
                state[assigned] /= assignment;
              }
              assignment = state[assigned];
            } catch(e) {
              state[assigned] = NaN;
            }
          }

          JSML.stateCache[index] = state[assigned];
        } else {
          state[assigned] = assignment = JSML.stateCache[index];
        }

        meta.push({
          type: "assignment",
          target: assigned,
          value: assignment
        });
        output.push(typeof assignment === "object" ? "(object)" : assignment);
      } else {
        let value = line
          .split(" ")
          .map(v => get(state, v.trim(), v))
          .join(" ");
        try {
          value = mjs.eval(value, state);
        } catch (e) {
          console.info(e);
        }
        meta.push({
          type: "eval",
          value
        });
        const type = typeof value;
        output.push(
          type === "object"
            ? "(object)"
            : type === "function"
            ? "(func)"
            : value
        );
      }
    }

    return [output, meta, state];
  },
  flatten: (parts, root = []) => {
    parts.forEach(part => {
      if (Array.isArray(part)) {
        JSML.flatten(part, root);
      } else if (typeof part === "function") {
        root.push(part);
      } else if (typeof part === "object") {
        if (part.toString) {
          root.push(part.toString());
        } else {
          root.push(JSON.stringify(part));
        }
      } else {
        root.push(
          ...part
            .replace(/\t\n/g, "")
            .replace(/  /g, " ")
            .replace(/\n\n/g, "\n")
            .split("\n")
            .filter(l => l.length)
        );
      }
    });

    return root;
  },
  parseFunctions: (string, state) => {
    // We're calling a custom function on a thing
    let i = 0;
    return (string + "").replace(
      /@([a-zA-Z]+)\(([^\)]+)?\)/gi,
      (match, fn, paramStr = "") => {
        i++;
        const params = paramStr.replace(/ /g).split(",");

        if (fn === "count" || fn === "length") {
          const things = get(state, params[0]);
          return things ? things.length : 0;
        } else if (fn === "rand" || fn === "random") {
          const seed = params.length ? params[0] : i;
          return JSML.FUNCTION.random(seed, state);
        } else if (SINGLE_PARAM_METHODS.includes(fn)) {
          const thing = get(state, params[0], params[0]);
          return Math[fn](thing);
        } else if (ARRAY_PARAM_METHODS.includes(fn)) {
          const values = [];
          params.forEach(param => {
            let value = get(state, param, 0);
            if (!value) {
              const parts = param.split(".");
              const key = parts.pop();
              get(state, parts.join("."), []).forEach(v => {
                values.push(v[key]);
              });
            } else {
              values.push(value);
            }
          });

          if (fn === "sum") {
            return JSML.FUNCTION.sum(values);
          } else if (fn === "avg" || fn === "mean") {
            return JSML.FUNCTION.mean(values);
          } else if (fn === "mode") {
            return JSML.FUNCTION.mode(values);
          } else {
            return Math[fn](...values);
          }
        }

        return null;
      }
    );
  },
  FUNCTION: {
    sum: values => {
      return values.reduce((acc, v) => acc + v, 0);
    },
    mean: values => {
      return JSML.FUNCTION.sum(values) / values.length;
    },
    median: values => {
      const numbers = [...values].sort();
      return numbers.length % 2 === 0
        ? (numbers[numbers.length / 2 - 1] + numbers[numbers.length / 2]) / 2
        : numbers[(numbers.length - 1) / 2];
    },
    mode: values => {
      return Object.entries(
        values.reduce((map, value) => {
          if (!map[value]) {
            map[value] = 0;
          }
          map[value]++;
          return map;
        }, {})
      )
        .sort((a, b) => a[1] - b[1])
        .pop()[0];
    },
    random: (seed, state) => {
      try {
        seed = mjs.eval(seed, state);
      } catch (e) {
        console.info(e);
      }
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }
};
JSML.FUNCTION.avg = JSML.FUNCTION.mean;

module.exports = JSML;
