// Something for Assembly Summer 2023 intro compo.
//
// Warming up old codes from 2019.
//
// TODO: remove 'window.' if not necessary for anything
// TODO: trick vars into pars; use with(Math)
//
// User interface in debug version: You can click top / bottom of canvas to
// go back and forth in graphics. (it is a bit buggy, you'll find out, but
// still it helps to see different parts of the show)
//
// Note to self: RegPack is great, but still Pnginator wins by tens
// or even hundreds of bytes.. Should look into the way p01 and folk are packing
// on server-side. Seems to be allowed in compos, so me too, me too..
//
// Some of this was adapted from p01's DWITTER-SON1K. Not much of that left,
// other than my greatest gratitude, once again, for great learnings about JS.
// Pretty much all I know about javascript comes from reading p01's codes (and
// the specification :)).
//
// License: Kindly credit this as prior work, and change the graphics
// and sound to something notably different. Otherwise do as you
// please. Technically this is "public domain" knowledge. Also, no
// warranty of any kind.
//
// Author: qma (aka "The Old Dude", or paavo.j.nieminen@jyu.fi )
var DURATION_SECONDS = 62;
var AUDIO_BUFSIZE = 4096;

// AudioContext and ScriptProcessor
var audioctx,sp;

// Start time of show (user click)
var startTimeInMillis = null;

// Hmm, assume this much provided on surrounding HTML, as is by pnginator:
// we have '<html><body><canvas id="c" /><script>' in the html..

// We're done with PNG unpack tricks, so can replace garbled content with this:
document.body.firstChild.data = "Click!";

// TODO: See how the top people did it last year by serving packed content

// Global time in seconds, matching audio exactly (updated in audio callback)
var audio_time = 0;

// "Graphics assets" :)
var fishpoint = [], bubblepoints = [];

var drawing_array = [];

/** Return a grayscale color of intensity and alpha as CSS color string.*/
var toRGB = (intensity, alpha) => {
    intensity = intensity*255|0;
    return `rgb(${intensity},${intensity},${intensity},${alpha})`;
}

// ---------------------------
// Some debug code, pretty much copy-pasted from my recent-ish 4k stuff.
// These should get swallowed automatically from the tiny compo version.

var framesDrawn = 0;            //DEBUG
var dbg_ms_at_last_seek = null; //DEBUG
var dbg_t_at_seek = 0;          //DEBUG
var dbg_paused = false;         //DEBUG

// Return time in seconds when using the debug seek.
var debug_upd_time = function(curTimeInMillis) {
    if (!dbg_ms_at_last_seek) dbg_ms_at_last_seek = startTimeInMillis;
    var ms_since_seek = dbg_paused ? 0:(curTimeInMillis - dbg_ms_at_last_seek);
    var t = dbg_t_at_seek + (ms_since_seek / 1000);
    return t;
}

var debug_seek = function(e) {
    framesDrawn = 0;
    // Handle seek and pausing in debug mode:
    target_s = e.pageX / innerWidth * 1.1 * DURATION_SECONDS;
    dbg_ms_at_last_seek = performance.now();
    startTimeInMillis = dbg_ms_at_last_seek - target_s * 1000
    dbg_t_at_seek = target_s;
    audio_time = target_s;
    if (e.pageY<(c.height/2)) dbg_paused = true;
    else dbg_paused = false;
}

// Debug information per frame, drawn on 2d context ctx at time t.
var debug_information = (ctx, t, w, h) => {
    /* Omit info if the URL ends in '#'. Use for tidy screenshots...  */
    if (location.href.slice(-1) == '#') return;

    framesDrawn++;
    var since_seek = ( performance.now() - dbg_ms_at_last_seek ) / 1000;
    var infotext = 't = ' + (t|0)
   	+ 's FPS (avg): '+((framesDrawn / since_seek) | 0)
	+' ar: ' + w/h;
    ctx.font = `${20}px Monospace`;
    ctx.clearRect(0, h-20, ctx.measureText(infotext).width, 20);
    ctx.fillStyle="#000";
    ctx.fillText(infotext, 0, h);
}

c.addEventListener("click", debug_seek); //DEBUG



// ---------------------- 
// Utility functions.. unused ones automatically discarded from compo version.

/*
// I'd like to know what rands I get.. seems to cost about 20-30 bytes..
var random_state = 0;
function rnd(){
    random_state = (16807 * random_state + 1) & 0x3fffff; //0x400000;
    return random_state / 4200000; // almost get 1.0 but not quite..
}
*/


// If 20 bytes costs too much, take the implementation-defined Math.random():
var rnd=()=>Math.random();

var aat = (t) => {
    return ((4*t|0)%2) * Math.sin([220,330][(t/4|0)%2]*6.28*t *(((2*t) % 6)|0) );
}

var audio_sample = (t) => {
    // Go from beep again..
    return (t > DURATION_SECONDS)?0 : ( aat(t)/2 + aat(t-1)/4 + aat(t-2)/8 );
};

/** The onaudioprocess handler. This gets called, technically, for audio output. */
var audioHandler = (event) => {
    var outbuf = event.outputBuffer.getChannelData(0);
    for (var isample = 0; isample < AUDIO_BUFSIZE;){
	if (dbg_paused) {outbuf[isample++] = 0; continue;} // DEBUG
	outbuf[isample++] = audio_sample(audio_time += 1 / audioctx.sampleRate);
    }
};

// GFX helper functions -----------------------------------------------------------------

/**
 * Perspective effect without aspect ratio.
 *
 * In: p==[x,y,z], f==1/Math.tan(fovY/2).
 *
 * Out: [f*x/z, f*y/z, z].
 *
 * Doesn't handle aspect ratio nor clipping planes.
 *
 */
var doPerspectiveFhc = (p, f) => {
    return [
	f*p[0]/p[2],
	f*p[1]/p[2],
	p[2]
    ];
};

var zsort = (a, b) => {
    return b[2]-a[2];
}

/**
 * A shape..
 **/
var whitefish_profile = (p) => {
    var d = (p[0]*p[0] + p[1]*p[1] + p[2]*p[2]) - .5;
    return d*d<.00001;
}

var drawing_array_push_wiggly = (x,y,z,pts,wiggle) => {
    for(var i=0; i<pts.length;i++){
	var p=pts[i];
	if (p[2]+z > 0)  // Clip so we can get close swim-bys without crashing
	    drawing_array.push([p[0] + x + Math.sin(3*wiggle-3*p[2])/8,
				p[1] + y,
				p[2] + z,
				p[3],
				p[4]
			       ]);
    }
}

// GFX init -----------------------------------------------------------------
var initAssets = () => {
    var i;
    // Sample points randomly from surface
    for(i=0;i<333;){
	var p = [rnd()-.5,
	     rnd()-.5,
	     rnd()
	    ];
	if (whitefish_profile(p)){
	    p[3] = 1-p[2]; // "color" as p[3]
	    p[4]=0; // No text.
	    bubblepoints[i] = [20*rnd()-9, 50*rnd(), 9*rnd(), 1, 0]
	    fishpoint[i++] = p;
	}
    }
    // I ended up putting this in the previous loop:
    //for(i=0; i<333; bubblepoints[i++] = [20*rnd()-9, 50*rnd(), 9*rnd(), 1, 0]){};
}

// Reset the canvas size on each redraw - extra work but less code.
var animation_frame = (t,
		       w = c.width = innerWidth,
		       h  = c.height = innerHeight,
		       s = c.style,
		       C = c.getContext('2d')) =>
    {
    s.position = "fixed"; s.left = s.top = 0;

    C.fillStyle="#301";
    C.fillRect(0, 0, w, h);

    drawing_array = [];

    /* Place some whitefish in the lake. Lake is 20 units long. */
    for (var i=0;i<8;i++){
	var batch = 1+(i%3);  // Divide into batches 1,2,3, ...
	drawing_array_push_wiggly(3*Math.sin(8*i+25),
				  2*Math.sin(i*3),
				  18 - (2*t*batch/3 % 20),
				  fishpoint,
				  t*(2+batch)/6+i);
    }

    drawing_array_push_wiggly(0, 4-t, 9, bubblepoints, t);

    // Now that we have "modelview" points in array, we can sort them
    // for painter's algorithm:
    drawing_array.sort(zsort);

    for(var i = 0; i < drawing_array.length; i++){
	var tp = doPerspectiveFhc(drawing_array[i], 3);
	C.fillStyle = toRGB(drawing_array[i][3], 1-tp[2]/17);

	C.beginPath();
        C.ellipse(w/2 + tp[0]*h/2, /*Screen x, account for aspect ratio here.*/
                  h/2 + tp[1]*h/2, /*Screen y*/
                  h/2/tp[2]/5,     /*Radius x*/
                  h/2/tp[2]/5,     /*Radius y*/
                  0, 0, 7);        /*No angle, full arc, a bit more than 2pi :)*/
	C.fill();
    }

    debug_information(C, t, w, h) //DEBUG
};

// This function wraps our own one for requestAnimationFrame()
var animation_driver = (curTimeInMillis) => {
    if (!startTimeInMillis) startTimeInMillis = curTimeInMillis;
    var t = (curTimeInMillis - startTimeInMillis) / 1000;
    t = debug_upd_time(curTimeInMillis); // DEBUG
    animation_frame(t);
    if (t < DURATION_SECONDS) requestAnimationFrame(animation_driver);
};

initAssets();

// Use window click handler..
onclick = () => {
    onclick = null; //DEBUG
    /* In debug mode I want to control the fullscreen myself, so iffalse..*/
    if (false)                                     //DEBUG
        c.style.cursor='none';
    if (false)                                     //DEBUG
        c.requestFullscreen();

  // Mind the deprecation note...
  // (https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor)
  audioctx = new AudioContext;
  sp = audioctx.createScriptProcessor(AUDIO_BUFSIZE, 0, 1);
  sp.connect(audioctx.destination);
  sp.onaudioprocess = audioHandler;

  // First call to animation will set up requestframe:
  animation_driver(0);
}
