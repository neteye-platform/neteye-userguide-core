
This quick guide will guide you in setting up documentation sources
and building NetEye documentation within a VM or docker
container.

Set up infrastructure
=====================

You need to enable `neteye-alpha` channels, then install the packages

* neteye-userguide-core
* python3-sphinx-virtualenv
* all *-userguide packages

Build HTML code
===============

To build source code into HTML simply execute the script provided::

  # build_neteye_userguide.sh

This will make sure to activate the python virtualenv and install all
required packages.

Display and access documentation
================================

Then, go to the `build/html` directory, start a local HTTP server and
allow connections to access it::

  # cd build/html
  # python3 -m http.server 8001 &
  # iptables -I IN_public_allow -p tcp -m tcp --dport 8001 -m conntrack --ctstate NEW,UNTRACKED -j ACCEPT

(I guess that high ports are closed by default)

Finally, access with a browser to `<neteye_IP>:8001`. This can be
useful even when writing new documentation and check if everything
compiles without warnings or errors.


Useful links
============

* The `official documentation
  <https://www.sphinx-doc.org/en/master/usage/restructuredtext/index.html>`_
  is the reference point if you need to add some specific markup, if
  you forgot some, or if you want to experiment with new roles and
  directives
* A `cheatsheet
  <http://openalea.gforge.inria.fr/doc/openalea/doc/_build/html/source/sphinx/rest_syntax.html>`_
  is available, for quick reference. It is a bit outdated, but the
  basic building blocks are there.
* Another `quick reference
  <https://docutils.sourceforge.io/docs/user/rst/quickref.html>`_
