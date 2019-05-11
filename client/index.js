import React, { Component } from "react";
import { render } from "react-dom";
import { ThemeProvider } from "react-jss";
import Calculator from "./components/Calculator";

// Render editor
const app = document.getElementById("root");

render(
  <div>
    <ThemeProvider theme={{}}>
      <Calculator
        initialValue={`
          r = (http://api.coindesk.com/v1/bpi/historical/close.json)
          r.2019-04-10
        `}
      />
    </ThemeProvider>
  </div>,
  app
);
