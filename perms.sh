#!/bin/sh
find ~/www -type d -exec chmod 711 {} \;
find ~/www -type f -exec chmod 644 {} \;
