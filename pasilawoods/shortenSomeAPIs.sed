# Short-hand names for some Web APIs.
# Yes, yes, it is a questionable trick forbidden in some events' rules..
# I think most of the fun and interest comes from all this trickery - using
# things for unintended purposes, as brittle as those APIs could be.
#
# Also, tinkering with these things are a good way of learning how the APIs
# are supposed to work also for their intended purposes :).
#
# Well, this time the trickery code costs more than the space it saves.
# (1169 vs 1146 at the time of benchmarking, using pnginator packing.)
# After trying to the best of my capacity, I got 30 bytes longer code with the trick
# than without. So, let it go, this time.. Fun try.
#
s/\.style/.st/g
s/\.getContext/.geCo/g
s/\.moveTo/.moTo/g
s/\.lineTo/.liTo/g
s/\.beginPath/.bePa/g
s/\.fillRect/.fiRe/g
s/\.arc/.ar/g
s/\.requestFullscreen/.reFu/g
s/\.createScriptProcessor/.crScPr/g
s/\.sampleRate/.saRa/g
