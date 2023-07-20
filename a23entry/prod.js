// Something for Assembly Summer 2023 intro compo.
//
// Warming up old codes from 2019.
//
// TODO: trick vars into pars; use with(Math)
// (Currently, these tricks can be done manually; wins no more than 20 bytes..)
//
// User interface in debug version: You can click top / bottom of canvas to
// pause/seek the show. Add "#" to end of URL for screenshots with info hidden.
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

const DURATION_SECONDS = 62;
const AUDIO_BUFSIZE = 4096;
const PERSPECTIVE_F = 3; // The "1/Math.tan(fovY/2)"

// Start time of show (user click)
var startTimeInMillis = 0;

// Hmm, assume this much provided on surrounding HTML, as is by pnginator:
// we have '<html><body><canvas id="c" /><script>' in the html..

// TODO: See how the top people did it last year by serving packed content

// Global time in seconds, matching audio exactly (updated in audio callback)
var audio_time = 0;

// "Graphics assets" :)
var stuffpoints = [];

var drawing_array = [];

// ---------------------------
// Some debug code, pretty much copy-pasted from my recent-ish 4k stuff.
// These should get swallowed automatically from the tiny compo version.

var dbg_frames_drawn = 0;       //DEBUG
var dbg_ms_at_last_seek = 0;    //DEBUG
var dbg_t_at_seek = 0;          //DEBUG
var dbg_paused = false;         //DEBUG

// Return time in seconds when using the debug seek.
var debug_upd_time = function(curTimeInMillis) {
    if (!dbg_ms_at_last_seek) dbg_ms_at_last_seek = startTimeInMillis;
    const ms_since_seek = dbg_paused ? 0:(curTimeInMillis - dbg_ms_at_last_seek);
    return dbg_t_at_seek + (ms_since_seek / 1000);
}

/** Click event handler that performs seek/pause of show in debug mode. */
var debug_seek = function(e) {
    // Handle seek and pausing in debug mode:
    const target_s = e.pageX / window.innerWidth * 1.1 * DURATION_SECONDS;
    dbg_paused = e.pageY < (c.height/2);
    dbg_ms_at_last_seek = performance.now();
    dbg_t_at_seek = target_s;
    // Back-track the global show start time according to the seek:
    startTimeInMillis = dbg_ms_at_last_seek - target_s * 1000;

    // If the show had already stopped, re-enter animation driver before time reset:
    if (audio_time >= DURATION_SECONDS)
	window.requestAnimationFrame(animation_driver);

    // Then, update global audio time
    audio_time = target_s;

    // reset FPS counter
    dbg_frames_drawn = 0;
}

// Debug information per frame, drawn on 2d context ctx at time t.
var debug_information = (ctx, t, w, h) => {
    /* Omit info if the URL ends in '#'. Use for tidy screenshots...  */
    if (window.location.href.slice(-1) == '#') return;

    dbg_frames_drawn++;
    const since_seek = ( performance.now() - dbg_ms_at_last_seek ) / 1000;
    const infotext = 't = ' + (t|0)
   	+ 's FPS (avg): '+((dbg_frames_drawn / since_seek) | 0)
	+' ar: ' + w/h;
    ctx.font = `${20}px Monospace`;
    ctx.clearRect(0, h-20, ctx.measureText(infotext).width, 21);
    ctx.fillStyle="#000";
    ctx.fillText(infotext, 0, h-1);
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


// Audio content for this show ---------------

var aat = (t) => {
    return ((4*t|0)%2) * Math.sin([220,330][(t/4|0)%2]*6.28*t *(((2*t) % 6)|0) );
}

var audio_sample = (t) => {
    // Go from beep again..
    return (t > DURATION_SECONDS)?0 : ( aat(t)/2 + aat(t-1)/4 + aat(t-2)/8 );
};

/** The onaudioprocess handler for ScriptProcessor which is deprecated, but extant.. */
var audioHandler = (e, outbuf = e.outputBuffer.getChannelData(0)) => {
    if (dbg_paused) {for(let isamp in outbuf) outbuf[isamp] = 0; return;} // DEBUG
    for (e in outbuf) outbuf[e] = audio_sample(audio_time += 1 / A.sampleRate); 
};


// GFX helper functions -----------------------------------------------------------------

/**
 * Perspective effect without aspect ratio.
 *
 * In: p==[x,y,z,w], f==1/Math.tan(fovY/2).
 *
 * Out: [f*x/z, f*y/z, z, w].
 *
 * Doesn't handle aspect ratio nor clipping planes.
 *
 */
var doPerspectiveFhc = ([x,y,z,w], f) => {
    return [
	f*x/z,
	f*y/z,
	z,
	w
    ];
};

/** Compare the z coordinate of two points */
var zsort = (a, b) => {
    return b[2]-a[2];
}

var drawing_array_push_at = (pts,x,y,z,t) => {
    for(var p of pts){
	if (p[2]+z > 0)  // Clip here
	    drawing_array.push([p[0] + x,
				p[1] + y,
				p[2] + z,
				p[3],
				p[4]
			       ]);
    }
}

/** Apply some transformations to pts and push to global drawing array
 * unless result is behind clipping plane at z=0.
 */
var drawing_array_push_mod = (pts,x,y,z,rY) => {
    for(var p of pts){
	var pp = [Math.cos(rY)*p[0] + Math.sin(rY)*p[2] + x,
		  p[1] + y,
		  - Math.sin(rY)*p[0] + Math.cos(rY)*p[2] + z,
		  p[3],
		  p[4]];
	if (pp[2] > 0) drawing_array.push(pp);
    }
}

/** Return a grayscale color of intensity and alpha as CSS color string.*/
var toRGB = (intensity, alpha) => {
    intensity = intensity*255|0;
    return `rgb(${intensity},${intensity},${intensity},${alpha})`;
}

/** A helper to make gradient creation a one-liner; didn't reduce packed size.
* Idea was like C.fillStyle = gradstops(C.createLinearGradient(w/2,0,w/2,h/2),
* [[0,"#225"],[.2,"#547"],[.4,"#c37"],[.6,"#e74"]]);
*/
var gradstops = (g, stops) =>
{
    for (var stop of stops) g.addColorStop(stop[0],stop[1]);
    return g;
}



// GFX init -----------------------------------------------------------------
// (Used to have a separate init function, but probably isn't worth it unless
// heavy pre-computation will be necessary..)


// GFX content --------------------------------------------------------------

/** A height map function */
var hmap = (x,z) => {
    return 3*Math.sin(x/6) + 2*Math.sin((x+z)/3) + Math.sin(z);
}


var idea_blobs1 = (t,w,h,C) => {
    /* Prepare some stuff to be drawn... */

    stuffpoints = [];

    for(var ix=-99; ix<100; ix+=15){
	for(var iz=-99; iz<100; iz+=15){
//	    var hh = hmap(ix,iz);
	    //	    var p = [ix,hh,iz,.4,0];
	    var p = [
		ix,
		Math.sin(ix+t) + Math.sin(iz+t*2),
		iz,
		    1,0
	    ]
	    stuffpoints.push(p);
	}
    }

    drawing_array = [];
    drawing_array_push_mod(stuffpoints,
			   0,
			   -4,
			   0-t/10,
			   0);



    // Now that we have "modelview" points in array, we can sort them
    // for painter's algorithm:
    drawing_array.sort(zsort);

    C.globalCompositeOperation = "screen";
    for(var tp of drawing_array){
	tp = doPerspectiveFhc(tp, PERSPECTIVE_F);
	//C.fillStyle = toRGB(tp[3]*(Math.min(1,.1*(20-tp[2]))), .2);
	//C.fillStyle = toRGB(1-tp[2]/380, 1);
	//C.fillStyle = "#732";

	gradient = C.createRadialGradient(w/2 + tp[0]*h/2,
					  h/2 - tp[1]*h/2,
					  0,
					  w/2 + tp[0]*h/2,
					  h/2 - tp[1]*h/2,
					  PERSPECTIVE_F*h/2/tp[2]*tp[3]);

  // Like a bluish dot of light in fog
	gradient.addColorStop(0, "#ffff");
	gradient.addColorStop(1, "#00f0");


/*
	// Building block of wispy water clouds
	gradient.addColorStop(0, "#fff5");
	gradient.addColorStop(.5, "#fff3");
	gradient.addColorStop(1, "#fff0");
*/

	C.fillStyle = gradient;


//  	C.beginPath();
//        C.ellipse(w/2 + tp[0]*h/2, /*Screen x, account for aspect ratio here.*/
//                  h/2 - tp[1]*h/2, /*Screen y - model y points 'up', screen 'down' */
//                  PERSPECTIVE_F*h/2/tp[2]*tp[3],     /*Radius x*/
//                  PERSPECTIVE_F*h/2/tp[2]*tp[3],     /*Radius y*/
//                  0, 0, 7);        /*No angle, full arc, a bit more than 2pi :)*/
//	C.fill();

//  	C.beginPath();
//        C.arc(w/2 + tp[0]*h/2, /*Screen x, account for aspect ratio here.*/
//              h/2 - tp[1]*h/2, /*Screen y - model y points 'up', screen 'down' */
//              PERSPECTIVE_F*h/2/tp[2]*tp[3],     /*Radius x*/
//              0, 7);        /*No angle, full arc, a bit more than 2pi :)*/
//	C.fill();

	/* When using alpha "blobs", could fill rectangle containing the gradient: */
	var radius = PERSPECTIVE_F*h/2/tp[2]*tp[3];
        C.fillRect(w/2 + tp[0]*h/2 - radius,
		   h/2 - tp[1]*h/2 - radius,
		   2*radius, 2*radius);

    }
}



function gener(x,y,z,p,q){
    if (p<.1) return;
    stuffpoints.push([x,y,z,p]);
    gener(x+p,y,z,q*p,q);
    gener(x+p,y+p,z+1,q*p,q);
}

var idea_blobs2 = (t,w,h,C) => {
    stuffpoints = [];
    gener(0,0,0,1,.1+t/120);

    drawing_array = [];
    drawing_array_push_mod(stuffpoints,
			   0,
			   0,
			   10,
			   t/10);

    //Sort not necessary if we draw silhouette
    //drawing_array.sort(zsort);
    
    for(var [x,y,z,s] of drawing_array){
	// tp = doPerspectiveFhc(tp, PERSPECTIVE_F);
	C.fillStyle = "#400";
	C.beginPath();
	// Screen x, y, account for perspective and aspect ratio here.
	const radius = PERSPECTIVE_F * h / 2 / z * s;
        C.arc(w/2 + PERSPECTIVE_F * h / 2 / z * x ,
              h/2 - PERSPECTIVE_F * h / 2 / z * y ,
              radius,
              0, 7);
	C.fill();
	//C.stroke();
    }
}




// Reset the canvas size on each redraw - extra work but less code.
var animation_frame = (t,
		       s = c.style,
		       w = c.width = innerWidth,
		       h = c.height = innerHeight,
		       C = c.getContext('2d')
		      ) =>
{
//    if ((w != innerWidth) || (h != innerHeight)){ .. }

    s.position = "fixed"; s.left = s.top = 0;

/*
    C.fillStyle="#301";
    C.fillRect(0, 0, w, h);
*/
    // Ok, I think gradients are a keeper for this prod..
    // Something I haven't played with much. Can do nice compositions it seems.
    var gradient;

    var d = (t/DURATION_SECONDS);

    // Sky
    gradient = C.createLinearGradient(w/2,0,w/2,h/2);
    gradient.addColorStop(0, "#225");
    gradient.addColorStop(.2, "#547");
    gradient.addColorStop(.4, "#c37");
    gradient.addColorStop(.6, "#e74");
    C.fillStyle=gradient;
    C.fillRect(0, 0, w, h/2);

    // Setting sun
    gradient = C.createRadialGradient(w/2, h/3+d*h, 0, w/2, h/3+d*h, h);
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(.05, "#fff");
    gradient.addColorStop(.11, "#ff1");
    gradient.addColorStop(.2, "#ff4");
    gradient.addColorStop(1, "#fff0");
    C.fillStyle=gradient;

    C.fillRect(0, 0, w, h);


    // Flat ground
    gradient = C.createLinearGradient(w/2,h/2,w/2,h);
    gradient.addColorStop(0, "#126");
    gradient.addColorStop(.6, "#241");
    C.fillStyle=gradient;

//    C.fillRect(0, h/2, w, h);


/*
    // Some distant hills.
    C.beginPath();
    //    C.ellipse(w/2-h, 2*h, h, h, 0,0,7);
    C.ellipse(w/2-h+d*h, h, h*2, .6*h, 0,0,7);
    C.ellipse(w/2+h+d*2*h, h, h*3, .6*h, 0,0,7);
    C.fill();
*/

    // Hills, hills, hills, maybe with fir kinda forest
    for(var iz = 5; iz > 0; iz--){

	gradient = C.createLinearGradient(0,h/2,0,h);
	//gradient.addColorStop(0, [,"#122","#125","#137","#13a","#14c","#14f"][iz]);
	gradient.addColorStop(0, "#28" + " 57ace"[iz]);
	gradient.addColorStop(1, "#241");
	C.fillStyle=gradient;

	C.beginPath();
	C.moveTo(w,h);
	C.lineTo(0,h);
	var bm = 0, seed=iz+25, bd = h/99/iz;
	for(var ix = w/2-2*h-h*t/(9*iz); ix < w/2+2*h; ix += h/400){
	    bm += (seed = (seed*16807+1) & 0xffff)<0x8000?bd:-bd
	    C.lineTo(ix, h/2 - bm - iz*h/40);
	    //C.lineTo(ix, h/2 - bm);
	}
	C.fill();
	//C.stroke();

    }

    //idea_blobs1(t,w,h,C);
    idea_blobs2(t,w,h,C);

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

// Use window click handler..
onclick = () => {
    onclick = null; //DEBUG
    /* In debug mode I want to control the fullscreen myself, so iffalse..*/
    if (false)                                     //DEBUG
        c.style.cursor='none';
    if (false)                                     //DEBUG
        c.requestFullscreen();

    A = new AudioContext; // This only possible after gesture, so here in onclick
    // Mind the deprecation note...
    // (https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor)
    var sp = A.createScriptProcessor(AUDIO_BUFSIZE, 0, 1);
    sp.connect(A.destination);
    sp.onaudioprocess = audioHandler;

    // First call to animation will set up requestframe:
    animation_driver(0);
}

// Assume we execute this from the PNG unpack trick,
// so we can replace garbled content with a nicer prompt to user:
document.body.firstChild.data = "Click!";
