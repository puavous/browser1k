// Something for Assembly Summer 2023 intro compo.
//
// I started by warming up my old codes from 2019 with the Moetkoe
// entry, but ended up with mostly new code..
//
// TODO: In the end, trick vars into pars; use with(Math); and more dirty tricks
// (Currently, these tricks can be done manually; wins no more than 20 bytes..)
//
// User interface in debug version: You can click top / bottom of canvas to
// pause/seek the show. Add "#" to end of URL for screenshots with info hidden.
//
// Note to self: Perhaps I should pick up using the Brotli packing
// method, since it was allowed in Assembly Summer 2022, so probably
// still OK (should ask, though..) It does pack much better than gzip
// and avoids all the PNG trickery that costs a lot compared to actual
// content.
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

// Hmm, assume this much provided on surrounding HTML, as is by pnginator, or
// other carrier: we have '<html><body><canvas id="c" /><script>' in the html..

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
var debug_information = (ctx, t, w, h, msg = '') => {
    /* Omit info if the URL ends in '#'. Use for tidy screenshots...  */
    if (window.location.href.slice(-1) == '#') return;

    dbg_frames_drawn++;
    const since_seek = ( performance.now() - dbg_ms_at_last_seek ) / 1000;
    const infotext = 't = ' + (t|0)
   	+ 's FPS (avg): '+((dbg_frames_drawn / since_seek) | 0)
	+' ar: ' + w/h
        + msg;
    ctx.font = `${20}px Monospace`;
    ctx.clearRect(0, h-20, ctx.measureText(infotext).width, 21);
    ctx.fillStyle="#000";
    ctx.fillText(infotext, 0, h-1);
}

c.addEventListener("click", debug_seek); //DEBUG



// ---------------------- 
// Utility functions.. unused ones automatically discarded from compo version.


/** Random generator to get deterministic rands.. seems to cost about 20-30 bytes,
but is a must for repeatable stochastic shapes. When "just noise" is not enough..

This version is skewed, ranges to almost 1.0 but not quite.. 0x400000 == 4194304.
0x3fffff/4200000 == 0.9986435714285714
*/
var random_state = 0;
var rnd = () => (random_state = (16807 * random_state + 1) & 0x3fffff) / 4200000;

/*
// Old version
function rnd(){
random_state = (16807 * random_state + 1) & 0x3fffff; //0x400000;
    return random_state / 4200000; // almost get 1.0 but not quite..
}
*/

// If 20 bytes costs too much, or need "just noise", can switch to
// the implementation-defined Math.random():
//var rnd=()=>Math.random();


// Audio content for this show ---------------
// audio_sample() will be called for each sample. t is time in seconds.
var aat = (t) => {
    return ((4*t|0)%2) * Math.sin([220,330][(t/4|0)%2]*6.28*t *(((2*t) % 6)|0) );
}

var audio_sample = (t) => {
    // Go from beep again..
    return (t > DURATION_SECONDS)?0 : ( aat(t)/2 + aat(t-1)/4 + aat(t-2)/8 );
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
 * unless result is behind clipping plane at z=0. Can be used for pointlike
 * objects; additional properties could be bundled in p[3] or p[4] that are
 * carried around unchanged..
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


var mod2 = (p,x,y,z,rY) => [Math.cos(rY)*p[0] + Math.sin(rY)*p[2] + x,
			    p[1] + y,
			    - Math.sin(rY)*p[0] + Math.cos(rY)*p[2] + z,
			    p[3]];
/* Applies transformation only. Doesn't clip or anything. */
var drawing_array_push_mod2 = (pts,x,y,z,rY) => {
    for(var [p,q] of pts){
	drawing_array.push([mod2(p,x,y,z,rY),mod2(q,x,y,z,rY)]);
    }
}


/*
 * Assume a scene is built into an array of objects. Plan would be to modify
 * coordinates in-place to get camera at (x,y,z) with rotations a and b for
 * "pan" and "tilt". Leave 4th value unhanged, so it could carry information
 * about the object other than its coordinates..
 * Transformation is Rx(b)Ry(a)T(xyx), probably easiest to compute usual way.
 *
 *
 * 1     0     0 0     s(a)   0  c(a)  0       1 0 0 x
 * 0  s(b)  c(b) 0        0   1     0  0       0 1 0 y
 * 0  c(b) -s(b) 0     c(a)   0 -s(a)  0       0 0 1 z
 * 0             1        0   0     0  1       0 0 0 1 ..
 *
 * Hmm... perhaps the code won't be too long just combining from small transforms..
 *
 */

// var Sin = Math.sin, Cos = Math.cos; // Could do this, but might not spare space
// Possibly the best thing to do is to just unwrap and inline a lot

// Separate transforms for arrays of 3 coordinates and a fourth value.
var rot4Y = (theta, p) => [Math.cos(theta)*p[0] + Math.sin(theta)*p[2],
			   p[1],
			   - Math.sin(theta)*p[0] + Math.cos(theta)*p[2], p[3]];
var rot4X = (theta, p) => [p[0],
			   Math.cos(theta)*p[1] + Math.sin(theta)*p[2],
			   - Math.sin(theta)*p[1] + Math.cos(theta)*p[2], p[3]];
var tr4  = (tr,p) => [p[0]+tr[0], p[1]+tr[1], p[2]+tr[2], p[3]];
var tri4 = (tr,p) => [p[0]-tr[0], p[1]-tr[1], p[2]-tr[2], p[3]];

/** Model a camera taken into a position in the scene, panned and tilted.
 * Positive pan to right, positive tilt up; given in radians.
 */
var camAt = (pts, pos, pan, tilt) => {
    for(var i in pts){
	pts[i] = [rot4X(-tilt, rot4Y(-pan, tri4(pos,pts[i][0]))),
		  rot4X(-tilt, rot4Y(-pan, tri4(pos,pts[i][1])))]
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

/** Cross product when a and b are array representations of 3-vectors*/
var cross3 = (a,b) => {
    return [ a[1]*b[2] - a[2]*b[1],
	     a[2]*b[0] - a[0]*b[2],
	     a[0]*b[1] - a[1]*b[0] ]
}
    




// GFX init -----------------------------------------------------------------
// (Used to have a separate init function, but probably isn't worth it unless
// heavy pre-computation will be necessary..)


// GFX content --------------------------------------------------------------


var idea_sky1 = (t,w,h,C) => {
    // Just a "sky" that brightens with time
    var gradient = C.createLinearGradient(
	0,-h*t/DURATION_SECONDS,0,h+3*(1-t/DURATION_SECONDS)*h);
    gradient.addColorStop(0, "#115");
    gradient.addColorStop(.8, "#fde");
    gradient.addColorStop(.9, "#fef");
    gradient.addColorStop(1, "#fff");
    C.fillStyle=gradient;
    C.fillRect(0, 0, w, h);

}



var idea_hills = (t,w,h,C) => {
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

    // Setting / rising sun ..
    gradient = C.createRadialGradient(w/2, h-d*h, 0, w/2, h-d*h, h);
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
	var bm = 0, bd = h/99/iz;
	//var seed = iz+25;
	random_state = iz;
	for(var ix = w/2 - 2*h - h*t/(9*iz); ix < w/2 + 2*h; ix += h/400){
	    //bm += (seed = (seed*16807+1) & 0xffff)<0x8000?bd:-bd
	    bm += rnd() < .5 ? bd : -bd;
	    C.lineTo(ix, h/2 - bm - iz*h/40);
	    //C.lineTo(ix, h/2 - bm);
	}
	C.fill();
	//C.stroke();
    }
}


var idea_hills2 = (t,w,h,C) => {
    var gradient;
    const d = (t/DURATION_SECONDS);

    // Sky
    gradient = C.createLinearGradient(0,0,0,h);
    gradient.addColorStop(0, "#115");
    gradient.addColorStop(.3, "#abc");
    gradient.addColorStop(.5, "#edd");
    C.fillStyle=gradient;
    C.fillRect(0, 0, w, h);

    // Setting / rising sun ..
    gradient = C.createRadialGradient(w/2, h-d*h, 0, w/2, h-d*h, h);
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(.05, "#fff");
    gradient.addColorStop(.1, "#ff1");
    gradient.addColorStop(.2, "#ff8");
    gradient.addColorStop(1, "#fff0");
    C.fillStyle=gradient;

    C.fillRect(0, 0, w, h);

    // Hills, hills, hills, maybe with fir kinda forest
    for(var iz = 5; iz > 0; iz--){

	// Blur looks really nice but slows down large shape painting..
	//C.filter = "blur("+iz/2+"px";
	gradient = C.createLinearGradient(0,0,0,h);
	gradient.addColorStop(0, "#26" + " 57acd"[iz]);
	gradient.addColorStop(1, "#131");
	C.fillStyle=gradient;

	C.beginPath();
	C.moveTo(w,h);
	C.lineTo(0,h);
	var bm = 0, bd = h/99/iz;
	random_state = iz;
	for(var ix = w/2 - 2*h - h*t/(9*iz); ix < w/2 + 2*h; ix += h/400){
	    bm += rnd() < .5 ? bd : -bd;
	    C.lineTo(ix, h/2 - bm - iz*h/20);
	}
	C.fill();
    }
}

/* Experiments with compositing discs; warm-up of the Moetkoe entry of 2019..*/
var idea_blobs1 = (t,w,h,C) => {
    /* Prepare some stuff to be drawn... */

    stuffpoints = [];

    for(var ix=-99; ix<100; ix+=15){
	for(var iz=-99; iz<100; iz+=15){
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

var idea_blobs1b = (t,w,h,C) => {
    //C.globalCompositeOperation = "screen";

    random_state = 1;
    for(var i=0; i<t; i+=1){
	var p = [-5 + 11*rnd(),
		 -4 + 8*rnd() + Math.sin(i+t),
		 3 + t/2 + 5 * rnd()]
	if (p[2]>0){
	    var radius = PERSPECTIVE_F/p[2]*h/2;
	    var cx = w/2 + PERSPECTIVE_F/p[2]*h/2*p[0];
	    var cy = h/2 - PERSPECTIVE_F/p[2]*h/2*p[1];
	    var gr = C.fillStyle = C.createRadialGradient(cx, cy, 0, cx, cy, radius);
	    gr.addColorStop(0, "#ffff");
	    gr.addColorStop(1, "#00f0");
	    C.fillRect(cx - radius, cy - radius, 2*radius, 2*radius);
	}
    }
}


/* Experiments with recursive random content generation */
function grower(pos, dir, age, extent){
    if (extent <= 0) return;
    
    // So far, I have become 'age' units in size. My future parts won't be seen.
    // Also, I could remain very small for all ages if I'm at an extreme location.
    const ds = 1; //.9; //Math.sqrt(extent/41);
    if (age>0) stuffpoints.push([pos[0],pos[1],pos[2],ds*age]);

    // Sometimes, I've branched to two random directions:
    // (must be same randoms each time, so recurse also 'not yet live' branches.)
    if (rnd()<.15) {
	grower([pos[0] + ds*age*dir[0],
		pos[1] + ds*age*dir[1],
		pos[2] + ds*age*dir[2]],
	       [dir[0]+rnd()-.5, dir[1]+rnd()-.5, dir[2]+rnd()-.5],
	       age - 0.03, extent-1);
	grower([pos[0] + ds*age*dir[0],
		pos[1] + ds*age*dir[1],
		pos[2] + ds*age*dir[2]],
	       [dir[0]+rnd()-.5, dir[1]+rnd()-.5, dir[2]+rnd()-.5],
	       age - 0.03, extent-1);
    } else {
    // Otherwise, I've just grown new stuff on top of me in the growth direction..
    grower([pos[0] + ds*age*dir[0],
	    pos[1] + ds*age*dir[1],
	    pos[2] + ds*age*dir[2]],
	   dir,
	   age - 0.03, extent-1);
    }
}

var idea_blobs2 = (t,w,h,C) => {
    stuffpoints = [];
    random_state = 2; grower([1,0,0],[0,.5,0], t/30, 40);

    drawing_array = [];
    drawing_array_push_mod(stuffpoints,
			   -30+t,
			   -1,
			   20,
			   t/2);

    drawing_array_push_mod(stuffpoints,
			   -10+t,
			   -1,
			   10,
			   t/4);

    drawing_array_push_mod(stuffpoints,
			   -20+t,
			   2,
			   100,
			   t/4);


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


/**
  Draw a silhouette of a 'capsule'. As a 2d projection that is
  two circles for the round ends and the area between their outer tangents.
  These three Components overlap; I'll leave it as a later exercise to figure
  out correct angles for the arcs so that each pixel would get painted only once.

  Compute first; draw then. Algorithm is eventually made from "first
  principles", solving simplest kinds of equations. This time the
  Internet didn't have it all figured out for me... Most stuff seemed
  to be overly general or use a geometric approach not easily adapted
  to this code and specific purpose. Wikipedia, for example, has some
  starters about what goes on with the tangents here:
  https://en.wikipedia.org/wiki/Tangent_lines_to_circles
    
  Notes on my latest Javascript learnings: NaNs are valid inputs for Canvas path
  operations. Such NaN-op doesn't alter the path. So, 0/0 is a good intermediate
  computation for intentional no-outputs. Infinities fine too.

  Specifically: Infinity is a fine value for parallel lines.
  NaN is a fine value for |r1-r2| > cdist (circle encloses other).

  These observations provide quite straightforward code, but then it probably
  has to be made dirty and obscure again by micro-optimizations for the 1k intro
  madness, eventually..
*/
var fillCapsuleSilhouette_orig = (C, cx1, cy1, r1, cx2, cy2, r2) => {
    // Actual Distance between circles in screen coordinates.
    var cdist = Math.hypot(cx2-cx1, cy2-cy1);

    // Unit vector (ux,uy) pointing towards circle 2 from circle 1 center
    var ux = (cx2 - cx1)/cdist;
    var uy = (cy2 - cy1)/cdist;
    
    // Unit vector orthogonal to (ux,uy)
    var [vx,vy,] = cross3([ux, uy, 0], [0, 0, 1]);
    
    // Distance used in computing: r1-r2 becomes 1.0 to keep equation simple.
    // Assuming circles are on x-axis; I'll project them to u,v afterwards.
    // Then I could solve it with pen, paper and my rusty math brain:
    var d = cdist / (r1 - r2);
    var tx = 1/d;
    var ty = Math.sqrt(1 - 1/d/d);
    
    // (tx,ty) now in unit circle coords. Back to actual coordinates..
    var p1x = tx*r1;
    var p1y = ty*r1;
    var p2x = tx*r2;
    var p2y = ty*r2;

    C.beginPath();
    C.arc(cx1, cy1, r1, 0, 7);
    C.arc(cx2, cy2, r2, 0, 7);
    C.fill();
    
    C.beginPath();
    C.moveTo(cx1 + p1x * ux + p1y * uy,   cy1 + p1x * vx + p1y * vy);
    C.lineTo(cx2 + p2x * ux + p2y * uy,   cy2 + p2x * vx + p2y * vy);
    C.lineTo(cx2 + p2x * ux - p2y * uy,   cy2 + p2x * vx - p2y * vy);
    C.lineTo(cx1 + p1x * ux - p1y * uy,   cy1 + p1x * vx - p1y * vy);
    C.fill();

}


/** It is almost impossible (at least for me) to decrypt this version; see
above original version to see what's going on.
*/
var fillCapsuleSilhouette_level_2_obfuscation = (C, cx1, cy1, r1, cx2, cy2, r2) => {
    // Actual Distance between circles in screen coordinates.
    var d = Math.hypot(cx2 - cx1, cy2 - cy1);
    //var cdist = Math.sqrt((cx2-cx1)**2 + (cy2-cy1)**2);

    // Unit vector (ux,uy) pointing towards circle 2 from circle 1 center
    var ux = (cx2 - cx1) / d;
    var uy = (cy2 - cy1) / d;
    
    // Unit vector orthogonal to (ux,uy). Damn.. rotate 90 degrees, be done..
    // var [vx,vy] = [uy, -ux];
    // And.. it is such a small op, so it is inlined below.. Destroying legibility.
    
    // Distance used in computing: r1-r2 becomes 1.0 to keep equation simple.
    // Assuming circles are on x-axis; I'll project them to u,v afterwards.
    // Then I could solve it with pen, paper and my rusty math brain:
    var D = d / (r1 - r2);

    // var [tx, ty] = [1 / D,  Math.sqrt(1 - 1/ D / D)];

    // (tx,ty) now in unit circle coords. Back to actual coordinates..
    var p1x = r1/D;
    var p1y = r1/D*Math.sqrt(D*D-1);  // ty*r1 applying some basic algebra
    var p2x = r2/D;
    var p2y = r2/D*Math.sqrt(D*D-1);  // ty*r2

    C.beginPath();
    C.arc(cx1, cy1, r1, 0, 7);
    C.arc(cx2, cy2, r2, 0, 7);
    C.fill();
    
    C.beginPath();
    C.moveTo(cx1 + p1x * ux + p1y * uy,   cy1 + p1x * uy - p1y * ux);
    C.lineTo(cx2 + p2x * ux + p2y * uy,   cy2 + p2x * uy - p2y * ux);
    C.lineTo(cx2 + p2x * ux - p2y * uy,   cy2 + p2x * uy + p2y * ux);
    C.lineTo(cx1 + p1x * ux - p1y * uy,   cy1 + p1x * uy + p1y * ux);
    C.fill();

}


/** Level 3 obscurity... */
var fillCapsuleSilhouette_lev3 = (C, cx1, cy1, r1, cx2, cy2, r2) => {
    
    // Actual Distance between circles in screen coordinates.
    var d = Math.hypot(cx2 - cx1, cy2 - cy1);
    //var d = Math.sqrt((cx2-cx1)**2 + (cy2-cy1)**2);

    // Difference of radii divided by distance:
    var I = (r1 - r2) / d;

    // Unit vector (ux,uy) pointing towards circle 2 from circle 1 center
    //    var ux = (cx2 - cx1) / d, uy = (cy2 - cy1) / d;
    
    // Distance used in computing: r1-r2 becomes 1.0 to keep equation simple.
    // Assuming circles are on x-axis; I'll project them to u,v afterwards.
    // Then I could solve it with pen, paper and my rusty math brain:
//    var D = d / (r1 - r2);

    // (tx,ty) now in unit circle coords. Back to actual coordinates..
//    var p1x = r1/D;
//  var p1y = r1/D*Math.sqrt(D*D-1);
    var a = Math.sqrt(1 - 1 * I*I);
//    var p1y = r1*a;
//    var p2x = r2/D;
//    var p2y = r2/D*Math.sqrt(D*D-1);
//    var p2y = r2*a;

    C.beginPath();
    C.arc(cx1, cy1, r1, 0, 7);
    C.arc(cx2, cy2, r2, 0, 7);
    C.fill();

    C.beginPath();
    C.moveTo( cx1  +  r1*I * (cx2 - cx1) /d  +  r1*a * (cy2 - cy1) /d,
	      cy1  +  r1*I * (cy2 - cy1) /d  -  r1*a * (cx2 - cx1) /d);
    C.lineTo( cx2  +  r2*I * (cx2 - cx1) /d  +  r2*a * (cy2 - cy1) /d,
	      cy2  +  r2*I * (cy2 - cy1) /d  -  r2*a * (cx2 - cx1) /d);
    C.lineTo( cx2  +  r2*I * (cx2 - cx1) /d  -  r2*a * (cy2 - cy1) /d,
	      cy2  +  r2*I * (cy2 - cy1) /d  +  r2*a * (cx2 - cx1) /d);
    C.lineTo( cx1  +  r1*I * (cx2 - cx1) /d  -  r1*a * (cy2 - cy1) /d,
	      cy1  +  r1*I * (cy2 - cy1) /d  +  r1*a * (cx2 - cx1) /d);
    C.fill();

}


/** Then, bye bye readability. See above to get any idea of how this emerged. */
var fillCapsuleSilhouette = (C, cx1, cy1, r1, cx2, cy2, r2,
    // Actual Distance between circles in screen coordinates.
			     d = Math.hypot(cx2 - cx1, cy2 - cy1),
    // Unit direction vector from circle 1 towards circle 2.
			     ux = (cx2-cx1)/d,
			     uy = (cy2-cy1)/d,
    // Difference of radii divided by distance:
			     I = (r1 - r2) / d,
    // Piece of equation called "a":
			     a = Math.sqrt(1 - I*I)
			    ) => {

/*
    C.beginPath();
    C.arc(cx1, cy1, r1, 0, 7);
    C.arc(cx2, cy2, r2, 0, 7);
    C.fill();
*/

// Depending on geometry, could leave out one or both cap arcs without
// very noticeable artefacts.. but then it really defeats the whole purpose
// of the exercise with finding outer tangents :). Oh, well, it was a nice
// learning experience, so let's not ask if it was useful otherwise..
    C.beginPath();
    C.arc(cx1, cy1, r1, 0, 7); // Depending on geometry, arcs could be here
    C.arc(cx2, cy2, r2, 0, 7); // Separate the paths if artefacts appear
    C.moveTo( cx1  +  I*r1 * ux              +  a*r1 * uy            ,
	      cy1  +  I*r1 * uy              -  a*r1 * ux            );
    C.lineTo( cx2  +  I*r2 * ux              +  a*r2 * uy            ,
	      cy2  +  I*r2 * uy              -  a*r2 * ux            );
    C.lineTo( cx2  +  I*r2 * ux              -  a*r2 * uy            ,
	      cy2  +  I*r2 * uy              +  a*r2 * ux            );
    C.lineTo( cx1  +  I*r1 * ux              -  a*r1 * uy            ,
	      cy1  +  I*r1 * uy              +  a*r1 * ux            );
    C.fill();
}

/** Fill a polygon with varying width. Using this for sharper turns is
 * suboptimal; you can see the stiches, so to speak.. But for smaller curves
 * the artefacts are very small and maybe could go mostly unnoticed?.
 */
var fillBetween = (C, cx1, cy1, r1, cx2, cy2, r2,
    // Actual Distance between circles in screen coordinates.
		   d = Math.hypot(cx2 - cx1, cy2 - cy1),
    // Unit vector orthogonal to direction from circle 1 towards circle 2.
		   nx = (cy2-cy1)/d,
		   ny = -(cx2-cx1)/d ) => {

// Well, could still paint arcs to fill some of the gaps..
//    C.beginPath();
//    C.arc(cx2, cy2, r2, 0, 7);
//    C.fill();

    C.beginPath();
    // Well, could still paint arcs to fill some of the gaps at joints..
    //C.arc(cx1, cy1, r1, 0, 7);
    C.arc(cx2, cy2, r2, 0, 7);
    C.moveTo( cx1 + r1 * nx, cy1 + r1 * ny );
    C.lineTo( cx2 + r2 * nx, cy2 + r2 * ny );
    C.lineTo( cx2 - r2 * nx, cy2 - r2 * ny );
    C.lineTo( cx1 - r1 * nx, cy1 - r1 * ny);
    C.fill();

}

/** Stroke from (cx1,cy1) to (cx2,cy2) with thickness (r1+r2)/2. This
 * looks surprisingly good at least when there's movement and a lot of
 * stuff. Also good for framerate.. Maybe an approximation to consider.
 */
var strokeBetween = (C, cx1, cy1, r1, cx2, cy2, r2) => {
    C.lineWidth = (r1+r2)/2;
    C.beginPath();
    C.moveTo( cx1, cy1 );
    C.lineTo( cx2, cy2 );
    C.stroke();
}





/** Preliminary test of the capsule code*/
var idea_blobs3a = (t,w,h,C) => {
    for (var i = -5; i<6; i++){
	C.fillStyle = "#784";
	fillCapsuleSilhouette(C,
			      w/2 + i*h/10, h/2, h/20,
			      w/2 + i*h/10, h/3, h/100);
    }
}


/** Second test of what could be capsule-drawn now..*/
var idea_blobs3b = (t,w,h,C) => {

    // Interpret drawing_array now as a series of capsule-definitions with
    // [x,y,z,radius] for the two endpoints and so on.
    // Could it be [x1,y1,z1,[x2,y2,z2,rad1,rad2]] or {a:[], b:[]} for sorting
    // and such effects? Now I'm limited to unsorted (or pre-sorted) paint..
    stuffpoints = [];
    for (var i = 0; i<10; i++){
	stuffpoints.push([0, 0, 0, .2],
			 [5*Math.sin(.63*i), 2*Math.sin(t), 5*Math.cos(.63*i), .1],
			 [5*Math.sin(.63*i), 2*Math.sin(t), 5*Math.cos(.63*i), .1],
			 [5*Math.sin(.63*i), 2*Math.sin(t)+3, 5*Math.cos(.63*i), 0]);
    }
    drawing_array = [];
    drawing_array_push_mod(stuffpoints,
			   Math.sin(t),
			   -3,
			   20,
			   t/3);

    drawing_array_push_mod(stuffpoints,
			   Math.sin(t/3),
			   3,
			   30,
			   t/4);

    drawing_array_push_mod(stuffpoints,
			   4+Math.sin(t),
			   2,
			   40,
			   -t/4);


    //Sort not necessary if we draw silhouette only. Capsule sort needs thinking..
    //drawing_array.sort(zsort);

    for (var i = 0; i<drawing_array.length; i+=2){
	C.fillStyle = "#210";
	
	// Screen x, y, account for perspective and aspect ratio here.
	var [x1,y1,z1,s1] = drawing_array[i];
	var [x2,y2,z2,s2] = drawing_array[i+1];
	fillCapsuleSilhouette(C,
			      w/2 + PERSPECTIVE_F * h / 2 / z1 * x1 ,
			      h/2 - PERSPECTIVE_F * h / 2 / z1 * y1 ,
			      PERSPECTIVE_F * h / 2 / z1 * s1 ,
			      w/2 + PERSPECTIVE_F * h / 2 / z2 * x2 ,
			      h/2 - PERSPECTIVE_F * h / 2 / z2 * y2 ,
			      PERSPECTIVE_F * h / 2 / z2 * s2);
    }
}


/** Another tree-like geometry builder. Can get quite organic looking things..
 *
 * Hmm.. format? Options.. Arrays of 8 values: xyz and radius for both ends of each piece.
 * Arrays of 2 arrays. Just try each and pick the solution with tiniest size, I guess..
 */
var stuffer = (pos, dir, stepsleft, smax) => {
    if (stepsleft < 1) return;

    // Produce one capsule here, from position to end point.
    var endp = [pos[0]+dir[0], pos[1]+dir[1], pos[2]+dir[2], (stepsleft-1)/smax];
    stuffpoints.push(pos, endp);

    var ll = Math.hypot(dir[0],dir[1],dir[2]);
    // Branch sometimes. More often closer to leaves:
    //if ((stepsleft/smax<.9) &&  (rnd()<.3)) {
    if (rnd()<(.9-stepsleft/smax)) {
	stuffer(endp,
		[.33*dir[0]+ll*(rnd()-.5),
		 .33*dir[1]+ll*(rnd()-.5),
		 .33*dir[2]+ll*(rnd()-.5), 0],
		//[.25*dir[0]+2*rnd()-1, .25*dir[1]+2*rnd()-1, .25*dir[2]+2*rnd()-1, 0],		
//		[dir[0], dir[1], dir[2], 0],
	        stepsleft-2, smax);
    }
    // Always grow a bit to almost same direction; feel some gravity downwards:
    stuffer(endp,
	    [dir[0]+.2*rnd()-.1,
	     dir[1]+.2*rnd()-.2,  // Hmm.. should make these vary over time.. kool efekts
	     dir[2]+.2*rnd()-.1, 0],
	    stepsleft - 1, smax);
}

/** Second test of what could be capsule-drawn now..*/
var idea_blobs3c = (t,w,h,C) => {

    // Interpret drawing_array now as a series of capsule-definitions with
    // [x,y,z,radius] for the two endpoints and so on.
    // Could it be [x1,y1,z1,[x2,y2,z2,rad1,rad2]] or {a:[], b:[]} for sorting
    // and such effects? Now I'm limited to unsorted (or pre-sorted) paint..
    stuffpoints = [];
    random_state = 5;
    for (itree = 0; itree<10; itree++){
	var inis = 10+20*rnd();
	stuffer([60*rnd()-30,0,60*rnd()-30,inis/30],[0,4,0,0],inis,30);
    }
    drawing_array = [];
    drawing_array_push_mod(stuffpoints,
			   0,
			   -63+t,
			   60,
			   -t/5);



    //Sort not necessary if we draw silhouette only. Capsule sort needs thinking..
    //drawing_array.sort(zsort);

    for (var i = 0; i<drawing_array.length; i+=2){
	//C.fillStyle = "#210";
	C.fillStyle = "#000";  // pure black on white could be simple and effective?
	
	// Screen x, y, account for perspective and aspect ratio here.
	var [x1,y1,z1,s1] = drawing_array[i];
	var [x2,y2,z2,s2] = drawing_array[i+1];
// Approximate variants. Visually imperfect but smaller and faster to draw:
//	strokeBetween(C,
//	fillBetween(C,
	fillCapsuleSilhouette(C,
			      w/2 + PERSPECTIVE_F * h / 2 / z1 * x1 ,
			      h/2 - PERSPECTIVE_F * h / 2 / z1 * y1 ,
			      PERSPECTIVE_F * h / 2 / z1 * s1 ,
			      w/2 + PERSPECTIVE_F * h / 2 / z2 * x2 ,
			      h/2 - PERSPECTIVE_F * h / 2 / z2 * y2 ,
			      PERSPECTIVE_F * h / 2 / z2 * s2);
    }
}






/** Another tree-like geometry builder. Can get quite organic looking things..
 *
 * Hmm.. format? Options.. Arrays of 8 values: xyz and radius for both ends of each piece.
 * Arrays of 2 arrays. Just try each and pick the solution with tiniest size, I guess..
 */
var twigs = (pos, dir, stepsleft, smax) => {
    if (stepsleft < 1) return;

    // Produce one capsule here, from position to end point.
    var endp = [pos[0]+dir[0], pos[1]+dir[1], pos[2]+dir[2], (stepsleft-1)/smax];
    stuffpoints.push([pos, endp]);

    var ll = Math.hypot(dir[0],dir[1],dir[2]);
    // Branch sometimes. More often closer to leaves:
    //if ((stepsleft/smax<.9) &&  (rnd()<.3)) {
    if (rnd()<(.9-stepsleft/smax)) {
	twigs(endp,
		[.33*dir[0]+ll*(rnd()-.5),
		 .33*dir[1]+ll*(rnd()-.5),
		 .33*dir[2]+ll*(rnd()-.5), 0],
	        stepsleft-2, smax);
    }
    // Always grow a bit to almost same direction; feel some gravity downwards:
    twigs(endp,
	    [dir[0]+.2*rnd()-.1,
	     dir[1]+.2*rnd()-.2,  // Hmm.. should make these vary over time.. kool efekts
	     dir[2]+.2*rnd()-.1, 0],
	    stepsleft - 1, smax);
}


/** Finally fixing the concept for this entry.. will have trees.. */
var idea_trees1 = (t,w,h,C) => {

    // Interpret drawing_array now as a series of capsule-definitions with
    // [x,y,z,radius] for the two endpoints and so on.
    // Could it be [x1,y1,z1,[x2,y2,z2,rad1,rad2]] or {a:[], b:[]} for sorting
    // and such effects? Now I'm limited to unsorted (or pre-sorted) paint..
    stuffpoints = [];
    random_state = 7;
    for (itree = 0; itree<10; itree++){
	var inis = 10+20*rnd();
	twigs([60*rnd()-30,0,60*rnd()-30,inis/30],[0,4,0,0],inis,30);
    }

    camAt(stuffpoints, [t/20,60-t,-60+t], t/10, t/10);

    //Sort not necessary if we draw silhouette only.
    //stuffpoints.sort(zsort);

    for ([[x1,y1,z1,s1],[x2,y2,z2,s2]] of stuffpoints){
	C.fillStyle = "#000";  // pure black on white could be simple and effective?

	if ((z1 < 0) || (z2 < 0)) continue;

// Approximate variants. Visually imperfect but smaller and faster to draw:
//	strokeBetween(C,
//	fillBetween(C,
	fillCapsuleSilhouette(C,
			      w/2 + PERSPECTIVE_F * h / 2 / z1 * x1 ,
			      h/2 - PERSPECTIVE_F * h / 2 / z1 * y1 ,
			      PERSPECTIVE_F * h / 2 / z1 * s1 ,
			      w/2 + PERSPECTIVE_F * h / 2 / z2 * x2 ,
			      h/2 - PERSPECTIVE_F * h / 2 / z2 * y2 ,
			      PERSPECTIVE_F * h / 2 / z2 * s2);
    }
}





// Reset the canvas size on each redraw - extra work but less code.
// Will this be a showstopper in some browser?
var animation_frame = (t,
		       w = c.width = innerWidth,
		       h = c.height = innerHeight,
		       C = c.getContext('2d')
		      ) =>
{

    //C.fillStyle="#fff"; C.fillRect(0, 0, w, h);

    idea_sky1(t,w,h,C);
    //idea_hills(t,w,h,C);
    //idea_hills2(t,w,h,C);
    //idea_blobs1(t,w,h,C);
    //idea_blobs1b(t,w,h,C);
    //idea_blobs2(t,w,h,C);  // "grower" with discs
    //idea_blobs3a(t,w,h,C);  // capsule minitest
    //idea_blobs3b(t,w,h,C);
    //idea_blobs3c(t,w,h,C);  // Tree silhouettes.. getting somewhere? works in B&W?
    idea_trees1(t,w,h,C);  // Tree silhouettes.. getting somewhere? works in B&W?

    debug_information(C, t, w, h, ' #darr='+drawing_array.length) //DEBUG
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

    // Magic of the packing algorithm is that repeating "c.style" reduces size.
    c.style.position = "fixed"; c.style.left = c.style.top = 0;

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
    sp.onaudioprocess = (e, outbuf = e.outputBuffer.getChannelData(0)) => {
	if (dbg_paused) {for(let isamp in outbuf) outbuf[isamp] = 0; return;} // DEBUG
	for (e in outbuf) outbuf[e] = audio_sample(audio_time += 1 / A.sampleRate);
    };

    // First call to animation will set up requestframe:
    animation_driver(0);
}

// Assume we execute this from the PNG unpack trick,
// so we can replace garbled content with a nicer prompt to user:
document.body.firstChild.data = "click";
