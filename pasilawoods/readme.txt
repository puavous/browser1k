* Memories From Pasila Woods

An entry to Assembly Summer 2023 1k Intro competition.

1023 bytes of appreciation to the event, its people, and its
surroundings.

Author: qma

(also known as "The Old Dude" in Instanssi contexts and Paavo Nieminen
in real life. The one currently with the Faculty of Information
Technology, University of Jyvaskyla; email and phone number will be
easily found with these clues. Happy to be in contact about anything.)

** Further credits

As always with anything Javascript, I must specifically thank p01 for
inspiration and learnings about the craziest size minification tricks.
I succumbed to the temptation of using Brotli for packing, like p01
showed us last year.

By the way, I'll include a Brotli-less version in the zip, so a
comparison can be made between the actual compo version and the
version I was initially about to submit with png packing.. The Brotli
trick allowed inclusion of background color and a much nicer shape of
the tree silhouettes. And no manual post-automatic minification was
needed this time - it is exactly the same as the included debug
version, only minified automatically with Closure compiler.

** The story behind

I have always wanted to make a small demoscene intro about gloomy,
eerie, woods with generated trees. The idea was clarified during
summer holidays 2023 jogging long runs at midnight and looking at
forests against skies after sunset. Streetlights were off to save
energy, and the landscapes were pretty. Another inspiration is the
Vallila print pattern Kelohonka by Tanja Orsjoki. I wanted to get
something similar on screen, animated.

Now, being at Assembly, I discover a connection with dear, sometimes
little fuzzy, memories from the certain little forest hill in Pasila
some steps away from the main event... This entry ends up representing
a lot of love to forests, Finnish summer midnights, and good times
with the demoscene community over the years. Remember to vote if you
like it or relate to the concept :).

** Tools used

HTML Canvas, Javascript, Brotli, memories of the real Pasila woods

** Source code

Sources with version history will be published soon after the
demoscene compos have been shown. They will be at my github account
next to Moetkoe from some years back:

https://github.com/puavous/browser1k

( Some build tools needed are in https://github.com/puavous/lmad1 )

** Instructions on how to view

I use (with the compo organizers' kind permission), the Brotli packing
trick introduced by p01 last year. Therefore the intro web page must
come from a server that attaches a content encoding header. I include
the same kind of mini server that p01 used last year. To run the intro
from a local machine, launch the server like this:

  node mini-server.js

Then take your browser to the elite port provided by the server:

  http://localhost:1337/

Click in the window exactly once to launch the intro. Enjoy the woods
experience. The intro will automatically go to fullscreen and hide the
mouse cursor. I would appreciate if you full screen manually before,
so there will be no "Press ESC to exit fullscreen" or such message in
the beginning.

Alternatively you can view the debug version. It is the same show but
with original non-minimized source with comments and bells and
whistles. To hide the info bar in the bottom of the screen, add "#" to
the end of the address of the debug version.


** Additional reduced version using pnginator

I put into the package also a reduced lo-fi version using
pnginator. It is called pasilawoods.lofi.NOT-FOR-COMPO.png.html

Browsers don't allow the PNG compression trick from a file system
source.  Use a web server or insecure browser session without CORS. In
July 2023, the following invocation works for Chrome, makes it
insecure:

"chrome.exe --disable-web-security --disable-gpu --user-data-dir=C:\\tmp\\chromeTemp"

I guess the show needs a lot of processing power. I'm developing on a
pretty heavy duty laptop and haven't benchmarked slower machines.
Slowdown and audio crackling is quite likely on lighter equipment.
