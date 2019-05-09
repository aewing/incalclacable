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

const JSML = {
  cache: {},
  state: {},
  stateCache: {},
  setState: data => {
    Object.assign(JSML.state, data);
  },
  parse: async (...script) => {
    const meta = [];
    const output = [];

    const lines = JSML.flatten(script);

    for (let index in lines) {
      let line = lines[index];
      if (typeof line === "function") {
        try {
          line = line(JSML.state);
        } catch (e) {}
      }

      line = JSML.parseFunctions(line, JSML.state);

      if (line.indexOf("--") === 0) {
        // This is a comment, so we do nothing.
      } else if (line.includes("=")) {
        let [assigned, ...parts] = line.split("=");
        assigned = assigned.trim();
        let assignment = parts.join("=").trim();

        if (!JSML.stateCache[index] || JSML.stateCache[index] !== assignment) {
          JSML.stateCache[index] = `${assignment}`;

          if (assignment.indexOf("(") === 0) {
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
            assignment = mjs.eval(assignment, JSML.state);
          } catch (e) {}

          JSML.state[assigned] = assignment;
        } else {
          assignment = JSML.state[assigned];
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
          .map(v => get(JSML.state, v.trim(), v))
          .join(" ");
        try {
          value = mjs.eval(value, JSML.state);
        } catch (e) {
          console.log(e);
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

    return [output, meta];
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
  parseFunctions: string => {
    // We're calling a custom function on a thing
    let i = 0;
    return (string + "").replace(
      /@([a-zA-Z]+)\(([^\)]+)?\)/gi,
      (match, fn, paramStr = "") => {
        i++;
        const params = paramStr.replace(/ /g).split(",");

        if (fn === "count" || fn === "length") {
          const things = get(JSML.state, params[0]);
          return things ? things.length : 0;
        } else if (fn === "rand" || fn === "random") {
          const seed = params.length ? params[0] : i;
          return JSML.FUNCTION.random(seed);
        } else if (SINGLE_PARAM_METHODS.includes(fn)) {
          const thing = get(JSML.state, params[0], params[0]);
          return Math[fn](thing);
        } else if (ARRAY_PARAM_METHODS.includes(fn)) {
          const values = [];
          params.forEach(param => {
            let value = get(JSML.state, param, 0);
            if (!value) {
              const parts = param.split(".");
              const key = parts.pop();
              get(JSML.state, parts.join("."), []).forEach(v => {
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
    random: seed => {
      try {
        seed = mjs.eval(seed, JSML.state);
      } catch (e) {}
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }
};
JSML.FUNCTION.avg = JSML.FUNCTION.mean;

module.exports = JSML;
