require("http").createServer((req, res) => {
  const path = (req.url || "/").slice(1);
  if (path === "") {
    const buffer = require("fs").readFileSync("pasilawoods.compo.html.br");
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Encoding", "br");
    res.setHeader("Content-Length", buffer.byteLength);
    res.write(buffer);
  }
  res.end();
}).listen(1337);

console.log(`
Open http://localhost:1337 to watch the entry

This mini http server is only here to pass the Content-Encoding we are
missing on file:// compared to the normal environment of a web page.
And as you can see, this is gratefully copied from last year's great
entry by P01 + 4MAT. Thanks, and cheers. You rock the 1k!  /qma.
`);
