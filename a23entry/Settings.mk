# --------------------------------------------------------------------
# Short and long name of this production and the name of its author:
# --------------------------------------------------------------------

## Change these to match your own production:

# A short name of the production, used in generated file names (don't use spaces!)
PROD_NAME=pasilawoods

# A "full" name of the production, used in zip package name (don't use spaces!)
PROD_NAME_FULL=Memories_From_Pasila_Woods_1k

# Your handle/nickname, also included in the zip package name (don't use spaces!)
PROD_AUTHOR=qma

# info file name
NFO_NAME=readme.txt


## Change these to match your local installation directories...
#
# If you are in my workshop, using the provided starter code package,
# everything is already included so you don't have to customize these.

# --------------------------------------------------------------------
# Let's make a demo base code
# --------------------------------------------------------------------

# The lmad1 library:
LMAD1=../../lmad1/


# --------------------------------------------------------------------
# External tools
# --------------------------------------------------------------------

# Closure compiler for Javascript minification:
CLOS=java -jar $(LMAD1)/external/closure-compiler.jar

# Pnginator for packing the intro:
PNGIN=ruby $(LMAD1)/tools/pnginator_modified.rb

## Optional (not used at Instanssi 2019, and not included in the starter package):
#DEFDB=$(LMAD1)/external/defdb
#GZTHERM=$(LMAD1)/external/gzthermal
DEFDB=echo "You may optionally download the defdb program and use it here with args:"
GZTHERM=echo "You may optionally download the gzthermal program and use it here with args:"
