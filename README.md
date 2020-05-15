LAB - Terminal Hacks
====================

This repository is a hacking area for developing a new embedded terminal.

To build it do:

```
docker build -t terminal-hacks .
```

To run it do:

```
docker run --rm -p 10080:10080 terminal-hacks
```

From a browser then access:

* http://localhost:10080

This will demonstrate it in the context of an iframe in the dashboard.

If you access it as:

* http://localhost:10080/myterminal

it will be just the terminal alone.

The goal is that it must be able to provide a different terminal session
for each URL of the form:

* http://localhost:10080/myterminal/session/nnn

where ``nnn`` is the terminal number.

When used in the dashboard, the key terminals are:

* http://localhost:10080/myterminal/session/1
* http://localhost:10080/myterminal/session/2
* http://localhost:10080/myterminal/session/3

If a reload occurs of the browser, it must be able to attach back to the same
terminal session corresponding to the session number.

When a separate terminal window is created from the dropdown menu, it creates
a unique terminal session each time, with session number starting at 100 and
incrementing.
