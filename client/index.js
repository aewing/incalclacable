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
          r = @random(clickX)
          a = 50
          r * a
        `}
      />
    </ThemeProvider>
  </div>,
  app
);
