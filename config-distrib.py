# =================================================================
#
# 1) Rename this file to config.py
#
#       $ mv config-distrib.py config.py
#
# 2) Edit it to configure the program.
#
# 3) When done, set CONFIG_DONE at the end of this file to True.
#
# =================================================================

import os

DEBUG   = True  # True or False - case sensitive!

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))

# --------------------------------------------------------------
# Where cache, graphs and filters will be stored.
# No trailing slash. Default: <BASE_DIR>/var
VAR_DIR     = "%s/var" % BASE_DIR

# --------------------------------------------------------------
# Automatically check for updates.
# Enable a client-side script that checks for new releases
# using GitHub API.
CHECKUPDATES_ENABLE = True  # True or False - case sensitive!
CHECKUPDATES_INTERVAL = 2 # days
CHECKUPDATES_PRERELEASE = False # True or False - case sensitive!

# --------------------------------------------------------------
# Configuration completed?
# Set the following variable to True once you completed your
# configuration.
CONFIG_DONE   = False # set to True when done

