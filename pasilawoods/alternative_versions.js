// For the sake of reference and documentation.
// I suck at "killing my darlings", but I cope with archiving them thus..
// Early versions of my capsule draw routine that was finally size-optimized
// beyond clarity.. Contains notes about use of NaN and Inf values.

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


/** Yet one more version, after compo with no deadline pressure... */
var fillCapsuleSilhouette2 = (C, cx1, cy1, r1, cx2, cy2, r2) => {

/*
    // Debug/devel helper: stroke circles with white
    C.strokeStyle = "#eee";
    C.beginPath();
    C.arc(cx1, cy1, r1, 0, 7);
    C.stroke();
    C.beginPath();
    C.arc(cx2, cy2, r2, 0, 7);
    C.stroke();
*/

    // Computations that give either usable alpha&beta or NaN if circle encloses another
    var d = (Math.hypot(cx2-cx1,cy2-cy1));
    var thecos = (r1-r2)/d;
    var alpha = Math.acos(thecos);
    if (cx2<cx1) alpha += Math.PI;  // Isn't this doable by *=-1 somewhere? check..
    var beta = Math.atan((cy2-cy1)/(cx2-cx1));

/*
    // Stroke it when circles don't completely overlap:
    C.strokeStyle = "#f00";
    C.beginPath();
    C.arc(cx1, cy1, r1, alpha + beta, 2*Math.PI-alpha  + beta);
    C.arc(cx2, cy2, r2, 2*Math.PI-alpha  + beta, alpha  + beta);
    C.closePath();
    C.stroke();
*/

    // Handle the sticky special cases of overlaps:
    C.beginPath();
    if (alpha == alpha){
	C.arc(cx1, cy1, r1, alpha + beta, 2*Math.PI-alpha  + beta);
	C.arc(cx2, cy2, r2, 2*Math.PI-alpha  + beta, alpha  + beta);
    } else {
	// alpha !== alpha then it is NaN and we select the larger of overlapping arcs:
	if (r1>r2){
	    C.arc(cx1, cy1, r1, 0, 7);
	} else {
	    C.arc(cx2, cy2, r2, 0, 7);
	}
    }
    C.closePath();
    C.fill();

    //C.strokeStyle = "#f00";C.stroke(); //Stroke for debug
}

/**
* Yet one more version, after compo with no deadline pressure...  Some
* bytes might come off by approximating 3.14 and 6.28 for PI and
* 2*PI..  That way I could actually stuff my Pasila Woods within 1047
* bytes, so losing only 24 bytes to original (using Brotli, of
* course). This version with exact Math.PI became 1051 bytes.
*
* This is the shortest micro-optimization I could reach a couple of
* days after Assembly Summer 2023. I just had to do the thing that I
* left as 'a later exercise' under deadline pressure the week before
* Assembly Summer 2023. Without an approaching deadline, the exercise
* was now the simplest ever. Enlightenment took place about the
* Wikipedia article about outer tangents, and I'm almost giving myself
* the "Dumbest Math Person Award of 2023" for my abandoned attempts at
* this before... But, it changes nothing afterwards - this version
* would not have been useful in my 2023 entry because it didn't have
* the requirement of drawing each pixel just once (which, to my
* understading, would come only from transparent drawing with alpha
* blending, or using blur, or stroking the outer boundary or... well,
* ok, there are quite a few intriguing use cases to try in a later
* entry in a later production).
*/
var fillCapsuleSilhouette2b = (C, cx1, cy1, r1, cx2, cy2, r2,
			       alpha = Math.acos((r1-r2)/Math.hypot(cx2-cx1,cy2-cy1)),
			       beta = Math.atan((cy2-cy1)/(cx2-cx1))
) => {
    // Computations that give either usable alpha&beta or NaN if circle encloses another
    if (cx2<cx1) alpha += Math.PI;  // Isn't this doable by *=-1 somewhere? check..

    // Handle the sticky special cases of overlaps:
    C.beginPath();
    if (alpha == alpha){
	C.arc(cx1, cy1, r1,
	      alpha + beta,
	      2*Math.PI - alpha + beta);
	C.arc(cx2, cy2, r2,
	      2*Math.PI - alpha + beta,
	      alpha  + beta);
    } else {
	// alpha !== alpha then it is NaN and we select the larger of overlapping arcs:
	if (r1>r2){
	    C.arc(cx1, cy1, r1, 0, 7);
	} else {
	    C.arc(cx2, cy2, r2, 0, 7);
	}
    }
    C.fill();

    //C.strokeStyle = "#f00";C.stroke(); //Stroke for debug
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

/** Another test of the capsule code*/
var idea_blobs4 = (t,w,h,C) => {
    stuffpoints = [];
    C.fillStyle = "#784";
    //let [x1,y1,r1,x2,y2,r2] = [w/3, h/2, h/4, 2*w/3, h/2, h/20];
    //let [x1,y1,r1,x2,y2,r2] = [w/3, h/2, h/3, 2*w/3, h/2, h/3 + Math.sin(t)*h/3];
    let [x1,y1,r1,x2,y2,r2] = [w/2, h/2, h/4,
			       w/2 + Math.sin(t/6)*h/4,
			       h/2 + Math.cos(t/6)*h/8, h/3 + Math.sin(t)*h/3];
    fillCapsuleSilhouette2(C, x1, y1, r1, x2, y2, r2);
}





/* "Brownian hills forever"... An early idea, abandoned when I got the tree idea..
 * Maybe get back to this at some later compo. You'll have to allow this much of
 * pre-publication in case I do..
 */
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

	// Blur looks really nice but slows down large shape painting a lot..
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

