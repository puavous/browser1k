// Something for Assembly Summer 2023 1k intro compo.
//
// This is the original, unobfuscated, code that I try to keep borderline tidy so
// that it can be created and possibly re-used easily. It has some rudimentary
// tools to help in content creation and debugging. And of course it has many
// obscure size-optimizations in place.
//
// Observe that this could be different from the actual 1024-byte compo version
// that is submitted to the system and shown on-site. The reason is that some
// ultimate size optimizations may require changes / reducstions to content at
// the very final stage after the automatic toolchain has been run and there is
// practically no possibility to synchronize those changes back to the original.
//
// User interface in debug version: You can click top / bottom of canvas to
// pause / seek the show. Adding "#" to the end of the URL hides the info bar
// so that clean screenshots can be taken from a paused show.
//
// Note to self: Perhaps I should pick up using the Brotli packing
// method, since it was allowed in Assembly Summer 2022, so probably
// still OK (should ask, though..) It does pack much better than zip
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

const DURATION_SECONDS = 69;
const AUDIO_BUFSIZE = 2048;

// Leaving these as notes for future.. I'm not using these constants anymore.
const PERSPECTIVE_F = 3; // The "1/Math.tan(fovY/2)"
// Values for some fovY->PERSPECTIVE_F:
// 90deg->1.0
// 60deg->1.732 45deg->2.414 36deg->3.077 30deg->3.732 28.07deg->4.0 20deg->5.671
const PERSPECTIVE_Fp2 = 2; // Pre-set "1/Math.tan(fovY/2)/2"

// Random state at beginning. TODO: always initialize upon content-creation?
var random_state = 0;

// Start time of show (user click). Another thing likely not used at Asm23 eventually
var startTimeInMillis = 0;

// Global time in seconds, matching audio exactly (updated in audio callback)
var audio_time = 0;
// Audio-system-related global vars; initialized upon user gesture.
var A,sp;

// "Graphics assets"; initialized before each screen update
var stuffpoints;


// Could do this kind of renaming, but might not spare space:
// var Sin = Math.sin, Cos = Math.cos, Hypot = Math.hypot, Max = Math.max;
// with(Math){var Sin = sin, Cos = cos, Hypot = hypot, Max = max, Pi=PI;}
// Possibly the best thing to do is to just unwrap and inline a lot?
//
// Nooo... this one remains a mystery: Seems to increase zipped size when used in the
// automatic Closure toolchain, but decreases size when applied in hand-tuning
// phase afterwards using hand-picked symbols. Some funny interplay with the naming
// scheme of Closure and the packing algorithm? Better not do it automatically, then?
// A thing to do though, after Closure, is to add like S=Math.sin and replace S(.)
// But it could be deeper than that. Not doing it automatically anyway because of the
// mixed observations.

// ------------- just a try.. benchmarking the usefulness of this in 1k again
// (Ended up not using this now)
var enumerate_and_shorten_API = (obj) => {
    // Apply p01's trick for grabbing short names from GL obj
    // (http://slides.com/pdesch/js-demoscene-techniques#/5/6)
    // This didn't help me earlier when trying to make a 1k..
    // was OK for 4k using GL. saved something like 30 bytes / 4kb.
    // Not much.. The trick itself costs some 45 bytes compressed with PNG.
    // Once again, not very helpful for 1k.. doesn't re-assign writable
    // properties which would be necessary for most size-optimizations..
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

/** Returns time in seconds when using the debug seek. */
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

/** Debug information per frame, drawn on 2d context ctx at time t. */
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
// There might be a neater way to disable inlining, but I didn't go looking for one.

// Version that doesn't go inline everywhere:
var rnd = () => {
    random_state = (16807 * random_state + 1) & 0x3fffff; return random_state / 4200000;
}

// Version that gives zero-centered values in so-so-approximate range [-1,1]
var crnd = () => {
    random_state = (16807 * random_state + 1) & 0x3fffff; return random_state / 2100000 - 1;
}

// If 20 bytes costs too much, or need "just noise", can switch to the 
// implementation-defined Math.random() that always returns different numbers by spec:
//var rnd=()=>Math.random();

var delay=[];
// Audio content for this show ---------------
// audio_sample() will be called for each sample. t is time in seconds.
// aat() short for 'actual audio at time..' produces content and there's a delay
// line in audio_sample(). Some earlier try-outs are left here, commented-out.
var aat = (t) => {
    //return (t > DURATION_SECONDS)?0 : ((4*t|0)%2) * Math.sin([220,330][(t/4|0)%2]*6.28*t *(((2*t) % 6)|0) );
    //return ((4*t|0)%2) * Math.sin([220,330][(t/4|0)%2]*6.28*t *(((2*t) % 6)|0) );
    //return (t > DURATION_SECONDS)?0 : ((4*t|0)%2) * Math.sin([220+t,330+3*t][(t/4|0)%2]*6.28*t *(((2*t) % 7)|0) );
    //return ((4*t|0)%2) * Math.sin((330+t*4)*6.28*t *(((2*t) % 6)|0) );
    //return ((4*t|0)%2) * (((330+t*4)*t) *(((2*t) % 6)|0)%2|0) ;
    //return ((4*t|0)%2) * ((330-t*4)*t)%1 ;
    return (t > DURATION_SECONDS)?0 :
	//((4*t|0)%2) * ((55+t*4)*t)%1 ;
    //(t%6<2)*(1-((t/3)%1)) * (((220-t*2)*t)%1) ;
    //(t%6<2)*(1-((t/3)%1)) * Math.sin((7000-(t+30)**2)*t) ; // Creepy, awkward (with unwanted pops)
    //(t%6<2)*(1-((t/3)%1)) * (((999-(t/5+8)**2)*t)%1) ;   // tried with saw wave
    Math.max(Math.sin(t),0) * Math.sin((7000-(t+30)**2)*t) ;   // Creepy, awkward, suitable

}

// Note-to-self: Tried different implementations in my local branches audio01{,altB} and
// decided to take altB that was 2 bytes larger but more logical with audio time.
// (just in case I need to revisit the alternatives.. won't be pushed to public repo).

var audio_sample = (t) => {
    var now = aat(t);
    //var past = delay[(t-.33)*A.sampleRate|0]||0;
    var past = delay[(t-.5)*A.sampleRate|0]||0;
    //var gone = t>60?0:t<26?0:aat(t-26); return delay[t*A.sampleRate|0] = now/3 - .7*past + .2*gone;
    //var past = delay[(t-1)*A.sampleRate|0]||0;
    return delay[t*A.sampleRate|0] = now/3 - .8*past;
    //var last = delay[(t*A.sampleRate|0)-1]||0;  // For simple filter
    //return delay[t*A.sampleRate|0] = .1*now + .6*last - .3*past;
    //return aat(t)/3+aat(t-1)/4+aat(t-2)/6+aat(t-3)/8; // fake delay if desperate
};



// GFX helper functions -----------------------------------------------------------------
// Some codes from some earlier productions just-in-case.
// Many probably not used.. The nice thing about Closure compiler is that it leaves
// out all the unused ones, so it is quite easy to pick-and-compare during creation.

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
 * "pan" and "tilt".
 */

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

/** Combine pan and tilt (tiltable cam on rotating stand..) */
var rot3YthenX = (pan, tilt, p) => [
    Math.cos(pan)*p[0] - Math.sin(pan)*p[2],
    Math.cos(tilt)*p[1] - Math.sin(tilt)*(Math.sin(pan)*p[0] + Math.cos(pan)*p[2]),
    Math.sin(tilt)*p[1] + Math.cos(tilt)*(Math.sin(pan)*p[0] + Math.cos(pan)*p[2])];

// Variations that contain fewer characters but pack worse both in gzip and Brotli
var sincos = (rad) => [Math.sin(rad), Math.cos(rad)];
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



/**
 * A tree-like geometry builder. Can get quite organic looking things..
 * Consists of capsule-like objects that may have different sizes of ends.
 *
 * So far, the leanest format seems to be an array of [pos1, pos2, size1, size2]
 * This builds into a global "stuffpoints" variable that needs to be set to [] before.
 */
var twigs = (pos, dir, stepsleft, smax) => {
    if (stepsleft < 1) return;

    // Produce one capsule here, from position to end point.
    var endp = add3(dir,pos);
    stuffpoints.push([pos, endp, stepsleft/smax/2, (stepsleft-1)/smax/2]);

    var ll = Math.hypot(...dir);
    // Branch sometimes. More often closer to leaves(?):
    //if ((stepsleft/smax<.9) &&  (rnd()<.3)) {
    //if (rnd()<(.9-stepsleft/smax)) {
    if (crnd()>.4) {
	twigs(endp,
	      add3(dir, randvec3(), 1/3, ll/3),
	      stepsleft-2, smax);
    }
    // Always grow a bit to almost same direction; feel some gravity downwards:
    var newd = add3(dir, randvec3(), 1, .2);
    newd[1]-=.1;  // Hmm.. should make these vary over time.. kool efekts

    twigs(endp,	newd, stepsleft - 1, smax);
}

// Dummy for size estimation while building, to see how much tree-likeness weighs.
var pigs = (pos, dir, stepsleft, smax) => {
    stuffpoints.push([pos, dir, 1, 0]);
}

/**
 * Finally fixing the concept for this entry.. will have trees..
 * I have always wanted to make a small intro about gloomy, eerie, woods.
 * The idea came more clear during summer holidays 2023 jogging long runs
 * at midnight and looking at forests against skies after sunset. Now,
 * being at Assembly, I find out a connection with great, sometimes little fuzzy,
 * memories from the certain little forest hill in Pasila some steps away
 * from Assembly. This entry will represent a lot of love to forests, Finnish
 * midnights, and good times with the demoscene community over the years.
 */
var idea_trees1 = (t,w,h,C) => {

    stuffpoints = [];
    random_state = 8;  // (used forest #8 to tune first camera runs but others OK..)
    for (var itree = 13; itree--;){
	//var inis = 25+5*crnd();
	var inis = 25;
	//twigs([itree*(6*rnd()-3), 0, itree*(6*rnd()-3)], [0,4,0,0], inis, 30);
	twigs([25*crnd(), 0, 25*crnd()], [0,4,0,0], inis, 30);
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
    //var pos = [1,3,30-2*t], pan = t, tilt = Math.PI/2; // wander through fast, spinning
    //var pos = [2,3,-60+2*t], pan = 0, tilt = t/DURATION_SECONDS * Math.PI; // drive through, tilting to absurd
    //var pos=[t/20,69-t,-60+t], pan=.2-t/60, tilt=.4-t/50; // tilt-to-view
    //var pos=[4,4,4], pan=t/6, tilt=Math.PI/2; // look up, spinning
    //var pos=[0,130-2*t,-130+2*t], pan=0, tilt=-Math.PI/5+t/200; // descend from the air

    // Observation: The upwards looking shots benefit from a wider-angle FOV setting
    // than the others. So, I'm adding perspective as part of camera parameters here.
    // View angle in Y is pre-computed into a value that is based on viewport height h as
    // "1/Math.tan(fovY/2)/2 * h" of the perspective transform.
    // Some values: 90deg->.5*h 36deg->1.54 * h  28.07deg->2.0 * h

    // Viewpoints. Will be circulated one after the other:
    var vps = [
        [[0,44,-40], 0, 1-Math.sin(t/20 /*/DURATION_SECONDS*3.5*/ ), 2 * h], // slowly-to-and-from-view
        //[[0,130-2*(t+10),-130+2*(t+10)], 0, t/40-1, 2 * h], // descend from the air
	[[0,110-2*t,-110+2*t], 0, t/40-1, 2 * h], // descend from the air
	[[(t-46),5,3], t/6, Math.PI/2, h], // look up, spinning, walk a bit
	//[[0,3,30-2*(t-43)], t, Math.PI/2] // wander through fast, spinning
	
    ]

    var [pos,pan,tilt,persp] = vps[t/20%3|0];
    //var [pos,pan,tilt] = vps[0];

    //Sort not necessary if we draw silhouette only. With more bytes, could have fog etc.
    //stuffpoints.sort(zsort);

    for (var [p1,p2,s1,s2] of stuffpoints){
	C.fillStyle = "#000";  // pure black on white could be simple and effective?

	// Model a camera taken into a position in the scene, panned and tilted.
	// Positive pan to right, positive tilt up; given in radians.
	p1 = rot3YthenX(pan, tilt, add3(pos,p1,-1));
	p2 = rot3YthenX(pan, tilt, add3(pos,p2,-1));
	if ((p1[2] < 1) || (p2[2] < 1)) continue;


// Approximate variants. Visually imperfect but smaller and faster to draw.
// In fact, for the current tree geometries, a full capsule is not needed.
//	strokeBetween(C,
	fillBetween(C,
//	fillCapsuleSilhouette(C,
			      w/2 + persp / p1[2] * p1[0] ,
			      h/2 - persp / p1[2] * p1[1] ,
			      persp / p1[2] * s1 ,
			      w/2 + persp / p2[2] * p2[0] ,
			      h/2 - persp / p2[2] * p2[1] ,
			      persp / p2[2] * s2);



/*
  // And, well, inlining the whole stroke thing gets 100 bytes away and
  // looks reeeally ok from far away.. but brakes down in close perspective shots..

	C.lineWidth = persp / p1[2] * s1 + persp / p2[2] * s2;
	C.lineCap = "round";  // Round caps for +10 bytes. Clip z must be >0
	C.beginPath();
	C.moveTo( w/2 + persp / p1[2] * p1[0] ,
		  h/2 - persp / p1[2] * p1[1] );
	C.lineTo( w/2 + persp / p2[2] * p2[0] ,
		  h/2 - persp / p2[2] * p2[1] );
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
