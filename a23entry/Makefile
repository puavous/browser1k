.PHONY: clean cleaner veryclean
# To use this makefile, you need to install:
#  - Java runtime platform and the Closure compiler for Javascript minification
#  - ruby interpreter, and the PNGinator program for Deflate compression
#  - basic GNU tools (make, bash, sed, ...)

include Settings.mk

# The above included file should set a couple of things (see the
# examples). When the included file and referenced sources are OK (and
# the tool programs installed), Linux users can just "make
# $(PROD_NAME_FULL)_by_$(PROD_AUTHOR).zip" and upload the resulting
# zip file to the compo system at a party place.

# While developing, you can try new things quickly with "make
# $(PROD_NAME).debug.html" and then reload the debug version in your
# browser.

# Every now and then, you should "make $(PROD_NAME).compo.html" to see
# how big your compo entry is, and that it still works even when
# minimized. It will take a longer time to build that one because of
# all the minification and compression needed, so you don't want to do
# that after each small change to your entry...


# Compo entry package:
$(PROD_NAME_FULL)_by_$(PROD_AUTHOR).zip: $(PROD_NAME).compo.html $(PROD_NAME).debug.html $(NFO_NAME)
	zip -j $@ $^

# Order matters because of catenation etc:

tmp.bulk.compo.js: prod.js
# Wrap inside one function so that names are local and thus obfuscated by closure
	echo "(function (){" > $@
	cat $^ >> $@
	echo "})();" >> $@
# Oh.. closure has an option --assume_function_wrapper .. but is it different?
#	cat $^ > $@

# Let me try Brotli. It seems trendy, and it does rid of some 300 bytes at once
# (which is 30% of the 1k compo quota!).
$(PROD_NAME).compo.html.br: tmp.closured.js
	echo "click<canvas id=c><script>" > tmp.tobr
	cat $< >> tmp.tobr
	echo "</script>" >> tmp.tobr
	brotli -f -o $@ tmp.tobr
	rm tmp.tobr


# Compo target: After minification, pack it
$(PROD_NAME).compo.html: tmp.closured.js
	$(PNGIN) tmp.closured.js $@

# Remove all debugging code, minify and pack everything.
tmp.closured.js: tmp.bulk.compo.js
	# Use tail and head to remove 'function(){...}();' used to guide Closure
	cat tmp.bulk.compo.js \
		| sed -f $(LMAD1)/tools/prep.sed \
		| $(CLOS) --assume_function_wrapper --strict_mode_input=false \
		| tail -c+13 | head -c-6 \
		> tmp.closured.js

	 # Some compression profiling for fun - if you wanna you canna..
	 # results are approximate, not same as Pnginator output.
	gzip -c tmp.closured.js > $@.gz
	$(DEFDB) $@.gz
	$(GZTHERM) -n $@.gz

# Debug target: just catenate stuff to an HTML file that has a Canvas called c:
$(PROD_NAME).debug.html: prod.js
	echo "<html><head /><body>This message shouldn't persist. See log for errors.<canvas id="c" /><script>" > $@
	echo "(function (){" >> $@
	cat $^ >> $@
	echo "})();" >> $@
	echo "</script></body></html>" >> $@

clean:
	-rm *~ tmp.* *.closured.js

cleaner: clean
	-rm *.compo.html
	-rm *.compo.html.br
	-rm *.debug.html
	-rm gzthermal-result.png
	-rm *.gz

veryclean: cleaner
	-rm *_by_*.zip
