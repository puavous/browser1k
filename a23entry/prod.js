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

// Assume this much provided on surrounding HTML, as is by pnginator, or
// other carrier: '<html><body><canvas id="c" /><script>' in the html..

const DURATION_SECONDS = 62;
const AUDIO_BUFSIZE = 2048;
const PERSPECTIVE_F = 3; // The "1/Math.tan(fovY/2)"
// Values for some fovY->PERSPECTIVE_F:
// 90deg->1.0
// 60deg->1.732 45deg->2.414 36deg->3.077 30deg->3.732 28.07deg->4.0 20deg->5.671

const PERSPECTIVE_Fp2 = 2; // Pre-set "1/Math.tan(fovY/2)/2"

// Random state at beginning. TODO: always initialize upon content-creation?
var random_state = 0;

// Start time of show (user click)
var startTimeInMillis = 0;

// Global time in seconds, matching audio exactly (updated in audio callback)
var audio_time = 0;
// Audio-system-related global vars; initialized upon user gesture.
var A,sp;

// "Graphics assets"; initialized before each screen update
var stuffpoints;


// ------------- just a try.. benchmarking the usefulness of this in 1k again
var enumerate_and_shorten_API = (obj) => {
    // Apply p01's trick for grabbing short names from GL obj
    // (http://slides.com/pdesch/js-demoscene-techniques#/5/6)
    // This didn't help me earlier when trying to make a 1k..
    // was OK for 4k using GL. saves something like 30 bytes / 4kb.
    // Not much.. The trick itself costs some 45 bytes compressed.
    // Once again, not very helpful for 1k.. doesn't re-assign properties
    // which would be necessary for most size-optimizations..
    var dbgNameLists = {}; //DEBUG
    for(s in obj){
        // Instanssi 2023 still had: gl[s.match(/^..|[A-Z]|\d\D+$/g).join('')]=gl[s];
        // Contemplation at some point.. some alternatives with few clashes:
        // gl[s.match(/^.|[A-Zhol]|\d|[ruiv]+$/g).join('')]=gl[s];
        //gl[s.match(/^.|[A-Zlp]|\d.|[fv]+$/g).join('')]=gl[s];
        //gl[s.match(/^.|[A-Zlp]|\d.*$/g).join('')]=gl[s];
        //gl[s.match(/^.|[A-Zlp\d]|[fuiv]+$/g).join('')]=gl[s];

        // The trick itself (not for GL but for other HTML APIs now):
        const trick_regex = /^..|[A-Z]./g;
        obj[s.match(trick_regex).join('')] = obj[s];
        // Gather names for clash inspection and creating a minifier:    //DEBUG
        var shortname = s.match(trick_regex).join('');                   //DEBUG
        if (shortname in dbgNameLists) {dbgNameLists[shortname].push(s); //DEBUG
        } else { dbgNameLists[shortname]=[s]; }                          //DEBUG
    }
    // Inspect all names and clashing ones //DEBUG
    var dbgClashing = {};               //DEBUG
    for(s in dbgNameLists)              //DEBUG
        if ((dbgNameLists[s].length>1)  //DEBUG
            && (!dbgNameLists[s][0].match(/^[A-Z]/g))) //DEBUG
                dbgClashing[s]=dbgNameLists[s]; //DEBUG
    console.log(dbgNameLists);          //DEBUG
    console.log(dbgClashing);           //DEBUG
    // Output a sed script to change original names that don't clash:   //DEBUG
    // Then we should be safe... Can use any name; minified if possible //DEBUG
    var dbgSedStrings=[]; //DEBUG
    for (s in dbgNameLists) {           //DEBUG
        if ((dbgNameLists[s].length==1) //DEBUG
            && (!dbgNameLists[s][0].match(/^[A-Z]/g)) //DEBUG
            ) {dbgSedStrings.push("s/\\."+dbgNameLists[s][0]+"(/."+s+"(/g"); //DEBUG
        }                               //DEBUG
    }                                   //DEBUG
    // console.log(dbgSedStrings.join('\n')); //DEBUG
}


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
// var random_state = 0; // Moved up, closer to other zero-initialized vars.

//var rnd = () => (random_state = (16807 * random_state + 1) & 0x3fffff) / 4200000;
// Note: Closure compiler inlines this everywhere. Some bytes shorter pack if
// use the below function and then manually convert its definition to
// "p=()=>(r=16807*r+1&0x3fffff)/42E5;" where p and r are names by Closure.

// Version that doesn't go inline everywhere:
var rnd = () => {
    random_state = (16807 * random_state + 1) & 0x3fffff; return random_state / 4200000;
}

// Version that gives zero-centered values in so-so-approximate range [-1,1]
var crnd = () => {
    random_state = (16807 * random_state + 1) & 0x3fffff; return random_state / 2100000 - 1;
}

// Old version:
/*
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

// Coordinate transforms and other computations for 3-vectors. Rotation directions
// are custom so that camera pan and tilt make most sense to me.. may or may not be
// usual counterclockwise ones..
var rot3Y = (theta, p) => [Math.cos(theta)*p[0] - Math.sin(theta)*p[2],
			   p[1],
			   Math.sin(theta)*p[0] + Math.cos(theta)*p[2]];
var rot3X = (theta, p) => [p[0],
			   Math.cos(theta)*p[1] - Math.sin(theta)*p[2],
			   Math.sin(theta)*p[1] + Math.cos(theta)*p[2]];
var add3  = (x,y,a=1,b=1) => [a*x[0]+b*y[0], a*x[1]+b*y[1], a*x[2]+b*y[2]];

var scale3 = (p,q) => [p[0]*q[0], p[1]*q[1], p[2]*q[2]];

/** Cross product when a and b are array representations of 3-vectors*/
var cross3 = (a,b) => {
    return [ a[1]*b[2] - a[2]*b[1],
	     a[2]*b[0] - a[0]*b[2],
	     a[0]*b[1] - a[1]*b[0] ]
}

/** Return a new vector with uniform randoms from [-.5,.5] */
var randvec3alt = () => [crnd()/2, crnd()/2, crnd()/2];

/** Return a new vector with uniform randoms from [-1,1] */
var randvec3 = () => [crnd(), crnd(), crnd()];


/** Add noise to v, from uniform distribution [-delta,delta] */
var perturb3 = (delta, v) => [v[0]+delta*(rnd()-.5),
			      v[1]+delta*(rnd()-.5),
			      v[2]+delta*(rnd()-.5)];

/** Combine pan and tilt (tiltable cam on rotating stand..) */
var rot3YthenX = (pan, tilt, p) => [
    Math.cos(pan)*p[0] - Math.sin(pan)*p[2],
    Math.cos(tilt)*p[1] - Math.sin(tilt)*(Math.sin(pan)*p[0] + Math.cos(pan)*p[2]),
    Math.sin(tilt)*p[1] + Math.cos(tilt)*(Math.sin(pan)*p[0] + Math.cos(pan)*p[2])];

// Variations that contain fewer characters but packs worse both in gzip and Brotli
var sincos = (rad) => [Math.sin(rad), Math.cos(rad)];
//var rot3YthenXvar = (pan, tilt, p, cp = Math.cos(pan), sp = Math.sin(pan), ct = Math.cos(tilt), st = Math.sin(tilt)) =>
var rot3YthenXvar = (pan, tilt, p, [sp,cp] = sincos(pan), [st,ct] = sincos(tilt)) =>
    [cp*p[0] - sp*p[2],
     ct*p[1] - st*(sp*p[0] + cp*p[2]),
     st*p[1] + ct*(sp*p[0] + cp*p[2])];


/**
 * Model a camera taken into a position in the scene, panned and tilted.
 * Positive pan to right, positive tilt up; given in radians.
 * (Such a short function - manually inlined; not calling this in drawing code..)
 */
var camAt = (pts, pos, pan, tilt) => {
    for(var p of pts){
	p[0] = rot3X(tilt, rot3Y(pan, add3(pos,p[0],-1)));
	p[1] = rot3X(tilt, rot3Y(pan, add3(pos,p[1],-1)));
    }
}

/** Return a grayscale color of intensity and alpha as CSS color string.*/
var toRGB = (intensity, alpha) => {
    intensity = intensity*255|0;
    return `rgb(${intensity},${intensity},${intensity},${alpha})`;
}

/** Return a CSS color string from a mix of two rgbs in range 0-1. No alpha.*/
var toRGBmix = (rgb1, rgb2, mixv) => {
    var c = add3(rgb1,rgb2,255*mixv|0, 255-255*mixv|0);
    return `rgb(${c[0]},${c[1]},${c[2]})`;
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

var idea_sky0 = (t,w,h,C) => {
    // A simpler "sky" that brightens with time with no gradient..
    C.fillStyle = toRGBmix([.8,.9,1],[.3,.1,.6],t/DURATION_SECONDS);
    C.fillRect(0, 0, w, h);
}

/* "Brownian hills forever"... */
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



/** Another tree-like geometry builder. Can get quite organic looking things..
 *
 * So far, the leanest format seems to be an array of [pos1, pos2, size1, size2]
 */
var twigs = (pos, dir, stepsleft, smax) => {
    if (stepsleft < 1) return;

    // Produce one capsule here, from position to end point.
    var endp = add3(dir,pos);
    stuffpoints.push([pos, endp, stepsleft/smax, (stepsleft-1)/smax]);

    var ll = Math.hypot(...dir);
    // Branch sometimes. More often closer to leaves(?):
    //if ((stepsleft/smax<.9) &&  (rnd()<.3)) {
    //if (rnd()<(.9-stepsleft/smax)) {
    if (crnd()>.4) {
	twigs(endp,
	      add3(dir, randvec3(), .33, ll/3),
	      stepsleft-2, smax);
    }
    // Always grow a bit to almost same direction; feel some gravity downwards:
    var newd = add3(dir, randvec3(), 1, .2);
    newd[1]-=.1;  // Hmm.. should make these vary over time.. kool efekts

    twigs(endp,	newd, stepsleft - 1, smax);
}

// Dummy for size estimation while building
var pigs = (pos, dir, stepsleft, smax) => {
    stuffpoints.push([pos, dir, 1, 0]);
}

/** Finally fixing the concept for this entry.. will have trees.. */
var idea_trees1 = (t,w,h,C) => {

    stuffpoints = [];
    random_state = 6;
    // Always put one tree in center?
    for (var itree = 0; itree<10; itree++){
	var inis = 25+5*crnd();
	//twigs([itree*(6*rnd()-3), 0, itree*(6*rnd()-3)], [0,4,0,0], inis, 30);
	twigs([20*crnd(), 0, 20*crnd()], [0,4,0,0], inis, 30);
	//twigs(scale3(randvec3(),[40, 0, 40]), [0,4,0,0], inis, 30);
    }

    // Trying out various ways of moving the camera around...
    // Some could be used for dramatic effect.
    // Some are good for examining the model from different angles.
    //var pos = [0,10,-60+2*t], pan = 0, tilt = 0; // drive through
    //var pos = [-60+2*t,6,-40], pan = 0, tilt = Math.PI/11; // drive by
    //var pos = [0,6,-40], pan = -.5+t/DURATION_SECONDS, tilt = Math.PI/11; // pan past
    //var pos = [0,3,-60+2*t], pan = 0, tilt = Math.PI/4; // drive through, looking a bit up
    //var pos = [1,3,-30+t], pan = 0, tilt = Math.PI/2; // wander forward, looking to zenith
    //var pos = [2,3,-60+2*t], pan = 0, tilt = t/DURATION_SECONDS * Math.PI; // drive through, tilting to absurd
    //var pos=[t/20,69-t,-60+t], pan=.2-t/60, tilt=.4-t/50; // tilt-to-view
    //var pos=[4,4,4], pan=t/6, tilt=Math.PI/2; // look up, spinning
    var pos=[0,130-2*t,-130+2*t], pan=0, tilt=-Math.PI/5+t/200; // descend from the air

    // Observation: The upwards looking shots would benefit from a different FOV setting
    // than the others. Think about making the camera more flexible..



    //Sort not necessary if we draw silhouette only.
    //stuffpoints.sort(zsort);

    for (var [p1,p2,s1,s2] of stuffpoints){
	C.fillStyle = "#000";  // pure black on white could be simple and effective?

	// Model a camera taken into a position in the scene, panned and tilted.
	// Positive pan to right, positive tilt up; given in radians.
	p1 = rot3YthenX(pan, tilt, add3(pos,p1,-1));
	p2 = rot3YthenX(pan, tilt, add3(pos,p2,-1));
	if ((p1[2] < 1) || (p2[2] < 1)) continue;


// Approximate variants. Visually imperfect but smaller and faster to draw:
//	strokeBetween(C,
	fillBetween(C,
//	fillCapsuleSilhouette(C,
			      w/2 + PERSPECTIVE_Fp2 * h / p1[2] * p1[0] ,
			      h/2 - PERSPECTIVE_Fp2 * h / p1[2] * p1[1] ,
			      PERSPECTIVE_Fp2 * h / p1[2] * s1 ,
			      w/2 + PERSPECTIVE_Fp2 * h / p2[2] * p2[0] ,
			      h/2 - PERSPECTIVE_Fp2 * h / p2[2] * p2[1] ,
			      PERSPECTIVE_Fp2 * h / p2[2] * s2);


/*
  // And, well, inlining the whole stroke thing gets 100 bytes away and
  // looks reeeally ok from far away.. but brakes down in close perspective shots..

	C.lineWidth = (PERSPECTIVE_Fp2 * h / p1[2] * s1 + PERSPECTIVE_Fp2 * h / p2[2] * s2)/2
	// C.lineCap = "round";  // Round caps for +10 bytes. Clip z must be >0
	C.beginPath();
	C.moveTo( w/2 + PERSPECTIVE_Fp2 * h / p1[2] * p1[0] ,
		  h/2 - PERSPECTIVE_Fp2 * h / p1[2] * p1[1] );
	C.lineTo( w/2 + PERSPECTIVE_Fp2 * h / p2[2] * p2[0] ,
		  h/2 - PERSPECTIVE_Fp2 * h / p2[2] * p2[1] );
	C.stroke();
*/

/*
  // Fill an arc at endpoints for extra 19 bytes
	C.beginPath();
	C.arc( w/2 + PERSPECTIVE_Fp2 * h / p2[2] * p2[0] ,
	       h/2 - PERSPECTIVE_Fp2 * h / p2[2] * p2[1],
	       (PERSPECTIVE_Fp2 * h / p1[2] * s1 + PERSPECTIVE_Fp2 * h / p2[2] * s2)/2/2,
	       0,7);
	C.fill()
	C.lineWidth = (PERSPECTIVE_Fp2 * h / p1[2] * s1 + PERSPECTIVE_Fp2 * h / p2[2] * s2)/2
	C.beginPath();
	C.moveTo( w/2 + PERSPECTIVE_Fp2 * h / p1[2] * p1[0] ,
		  h/2 - PERSPECTIVE_Fp2 * h / p1[2] * p1[1] );
	C.lineTo( w/2 + PERSPECTIVE_Fp2 * h / p2[2] * p2[0] ,
		  h/2 - PERSPECTIVE_Fp2 * h / p2[2] * p2[1] );
	C.stroke();
*/
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

    // A static one-color background would be very cheap
    //C.fillStyle="#fff"; C.fillRect(0, 0, w, h);
    //C.fillStyle="#cdf"; C.fillRect(0, 0, w, h);
    C.fillStyle="#ffe"; C.fillRect(0, 0, w, h);

    //idea_sky0(t,w,h,C);     // Single color, but changes over time. +60 bytes?!
    //idea_sky1(t,w,h,C);     // A gradient would be sweet, but it costs a lot.
    //idea_hills2(t,w,h,C);
    //idea_blobs3a(t,w,h,C);  // capsule minitest
    idea_trees1(t,w,h,C);  // Tree silhouettes.. getting somewhere? works in B&W?

    debug_information(C, t, w, h, ' #darr='+stuffpoints.length) //DEBUG
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

    A = new AudioContext; // This only possible after gesture, so here in onclick
    // Mind the deprecation note...
    // (https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor)

    // This trick was tried, and found not to decrease but to increase size:
    // enumerate_and_shorten_API(c);
    // enumerate_and_shorten_API(c.getContext("2d"));
    // enumerate_and_shorten_API(A);

    // Magic of the packing algorithm is that repeating "c.style" reduces size.
    c.style.position = "fixed"; c.style.left = c.style.top = 0;

    /* In debug mode I want to control the fullscreen myself, so iffalse..*/
    if (false)                                     //DEBUG
        c.style.cursor='none';
    if (false)                                     //DEBUG
        c.requestFullscreen();

    sp = A.createScriptProcessor(AUDIO_BUFSIZE, 0, 1);
    sp.connect(A.destination);
    sp.onaudioprocess = (e, outbuf = e.outputBuffer.getChannelData(0)) => {
	if (dbg_paused) {for(let isamp in outbuf) outbuf[isamp] = 0; return;} // DEBUG
	for (e in outbuf) outbuf[e] = audio_sample(audio_time += 1 / A.sampleRate);
	// Graphics update from audio callback. Very dirty but might need those bytes:
	// animation_frame(audio_time);
    };

    // First call to animation will set up requestAnimationFrame:
    animation_driver(0);
}

// Assume we execute this from the PNG unpack trick,
// so we can replace garbled content with a nicer prompt to user:
document.body.firstChild.data = "click";
