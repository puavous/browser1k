// Note to readers: This is not exactly the same as the compo version seen at
// Assembly 2019. That one was manually optimized after going through closure
// compiler... not much resemblance to this one anymore :). My test audience
// told me that the earlier proof-of-concept was better than this newer version,
// so I went to compo with that.
//
// User interface in debug version: You can click top / bottom of canvas to
// go back and forth in graphics. (it is a bit buggy, you'll find out, but
// still it helps to see different parts of the show)
//
// Note to self: RegPack is great, but still Pnginator wins by tens
// or even hundreds of bytes..
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
var LENGTH_SECONDS=62;

// AudioContext and ScriptProcessor
var audioctx,sp;

// Hmm, we can have '<html><body><canvas id="c" /><script>' in the html..
var a = document.getElementById("c");
c = a.style; c.position = "fixed"; c.left = c.top = 0;
c = a.getContext('2d');

// Global time in seconds, matching audio exactly (updated in audio callback)
var audio_time = 0;

// Audio filter state
var fprev = 0;

// "Graphics assets" :)
var fishpoint = [], fishpoint2 = [], bubblepoints = [];

var drawing_array = [];

/** Return a grayscale color of intensity and alpha as CSS color string.*/
function toRGB(intensity, alpha){
    intensity = intensity*255|0;
    return `rgb(${intensity},${intensity},${intensity},${alpha})`;
}

var framesDrawn = 0; //DEBUG

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

function audio_sample(t) {
    // Funny variable spectrum noise. Reminds a watery inhabitat..
    //return fprev = (.6-.4*Math.sin(8+t/3))*(.99*fprev - rnd()/99);
    //return fprev = (.6+.4*Math.sin(11+t/3))*(.99*fprev - rnd()/99);
    // Some bytes shorter with almost same-ish sound:
    return fprev = (t>LENGTH_SECONDS)?0:(.7-.4*Math.sin(8+t/3))*(.9*fprev+(1-2*rnd())/99);

    // Constant spectrum noise:
    //    return (.5-.4*Math.cos(t/2))*(fprev=(.99*fprev - .01*(.5-rnd())));
};

/** The onaudioprocess handler. This gets called, technically, for audio output. */
function audioHandler(event){
    var outbuf = event.outputBuffer.getChannelData(0);
    for (var isample = 0; isample < 1024;){
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
function doPerspectiveFhc(p, f) {
    return [
	f*p[0]/p[2],
	f*p[1]/p[2],
	p[2]
    ];
};

function zsort(a, b){
    return b[2]-a[2];
}

/**
 * Return true if point p==[x,y,z] is on the surface of a fishy model (fish along z-axis)
 *
 * How do you make such a model? Pen and paper, children... pen and
 * paper. And Octave/MATLAB a=0:.01:3; figure; plot(a,sin(a)); % you go from there...
 * remember to do an image search on "siika" and compare if you can sell your equation
 * as a whitefish and keep it in 1k limits :). I know there should be fins but I just
 * couldn't make 'em fit.
 **/
function whitefish_profile(p){
    var l = Math.sin(3*(Math.sin(3*p[2])*Math.sin(8+3*p[2])+p[2])/2)/5;
    var d = (9*p[0]*p[0]+p[1]*p[1]) - (l*l);
    return d*d<.00001;
}

function drawing_array_push_wiggly(x,y,z,pts,wiggle){
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
function initAssets(){
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
	    fishpoint2[i] = p;
	    fishpoint[i++] = p;
	}
    }
    fishpoint2[i]=[.3,0,.3,1,1];
    //fishpoint[i++]=[.3,0,0,1,1];  /* Text annotations (100bytes) */
    // I ended up putting this in the previous loop:
    //for(i=0; i<333; bubblepoints[i++] = [20*rnd()-9, 50*rnd(), 9*rnd(), 1, 0]){};
}

function animation_frame(t) {
    t = t-2
//    var w = innerWidth, h = innerHeight;
//    if (w != Cw || h != Ch) {Cw=a.width=w; Ch=a.height=h;}
// Nah, let's just reset the canvas on each redraw - if my old laptop can
// do it, so can a newer compo machine at Assembly:
    var w = a.width = innerWidth;
    var h = a.height = innerHeight;
    c.fillStyle="#045";
    c.fillRect(0, 0, w, h);

    drawing_array = [];

    /* Place some whitefish in the lake. Lake is 20 units long. */
    for (var i=0;i<8;i++){
	var batch = 1+(i%3);  // Divide into batches 1,2,3, ...
	drawing_array_push_wiggly(3*Math.sin(8*i+25),
				  2*Math.sin(i*3),
				  18 - (2*t*batch/3 % 20),
				  i?fishpoint:fishpoint2,
				  t*(2+batch)/6+i);
    }

    drawing_array_push_wiggly(0, 4-t, 9, bubblepoints, t);

    // Now that we have "modelview" points in array, we can sort them
    // for painter's algorithm:
    drawing_array.sort(zsort);

    for(var i=0;i<drawing_array.length;i++){
	var tp = doPerspectiveFhc(drawing_array[i], 3);
	c.fillStyle = toRGB(drawing_array[i][3], 1-tp[2]/17);

        /* Text.. */
	if (drawing_array[i][4] /*contains text?*/){
	    c.fillStyle = toRGB(drawing_array[i][3], t/17-2.4);
	    c.font = h/2/tp[2]+`px arial`;
	    c.fillText("Yhen kilon siika",
		       w/2 + tp[0]*h/2, /*Screen x, account for aspect ratio here.*/
		       h/2 + tp[1]*h/2  /*Screen y*/);
	} else {
	    c.beginPath();
	    c.ellipse(w/2 + tp[0]*h/2, /*Screen x, account for aspect ratio here.*/
		      h/2 + tp[1]*h/2, /*Screen y*/
		      h/2/tp[2]/5,     /*Radius x*/
		      h/2/tp[2]/5,     /*Radius y*/
		      0, 0, 7);        /*No angle, full arc, a bit more than 2pi :)*/
	    c["fill"]();   // Closure compiler goes all polyglotsy if there's c.fill() here!
	}
    }

    framesDrawn++;                      //DEBUG
    c.font = `${20}px Monospace`;       //DEBUG
    c.clearRect(0,h-20,w/2,20);         //DEBUG
    c.fillStyle="#000";                 //DEBUG
    c.fillText('t = ' + (t|0)           //DEBUG
	       + 's FPS (avg): '+((framesDrawn/t)|0)  // DEBUG
	       +' ar: ' + w/h, 0, h);   //DEBUG
};

// This function wraps our own one for requestAnimationFrame()
function animation_driver(curTimeInMillis) {
    animation_frame(audio_time);
    if (audio_time<LENGTH_SECONDS) requestAnimationFrame(animation_driver);
};

initAssets();

a.onclick = () => {

// Mind the deprecation note...
// (https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor)
audioctx = new AudioContext;
sp = audioctx.createScriptProcessor(1024, 0, 1);
sp.connect(audioctx.destination);
sp.onaudioprocess = audioHandler;

// First call to animation will set up requestframe:
animation_driver();
}

//-------------- some debug code copy-pasted from the old 4k stuff
// Debug version seek to time                    //DEBUG
a.addEventListener("click", function(e){         //DEBUG
    audio_time =                                 //DEBUG
        e.pageX/a.width*1.1*LENGTH_SECONDS;      //DEBUG
    animation_driver();                          //DEBUG
});                                              //DEBUG
