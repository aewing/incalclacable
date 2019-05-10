const App = require("@emitterware/app").default;
const HTTP = require("@emitterware/http").default;
const Bundler = require("@emitterware/bundler").default;
const serve = require("@emitterware/serve");

const app = new App();

const http = new HTTP({
	host: "0.0.0.0",
	port: 3000
});

app.subscribe(http);

if (process.env.NODE_ENV === "production") {
	app.on("http", serve("/", path.resolve("../dist"), true));
} else {
	app.on("http", new Bundler("client/index.html"));
}