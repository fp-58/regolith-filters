#!/usr/bin/env python3

from shutil import rmtree
from glob import iglob
from os.path import isdir
from os import remove
from sys import argv

for index in range(1, len(argv)):
    for path in iglob(argv[index]):
        if isdir(path):
            rmtree(path)
        else:
            remove(path)
