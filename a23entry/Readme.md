* tbd

Tools used:
Javascript, PNGinator, zopfli

Browsers don't allow the PNG compression trick from a file system source.
Use web server or insecure browser session without CORS.

In July 2023 the following invocation works for Chrome:
"chrome.exe --disable-web-security --disable-gpu --user-data-dir=C:\\tmp\\chromeTemp"

