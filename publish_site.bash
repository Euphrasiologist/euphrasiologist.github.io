#!/usr/bin/env bash

git add .
# just add the commit message as the argument
git commit -m "$1"
git push

# now delete the branch gh-pages remotely
# and locally
git push -d origin gh-pages
git branch -d gh-pages

# now push and create the branch again remotely
# and locally I guess...
git subtree push --prefix public origin gh-pages

# generate your token here:
# https://github.com/settings/tokens
TOKEN=$(cat TOKEN)

# now add my CNAME back to the repo
curl \
  -i \
  -u "$TOKEN" \
  -X PUT \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/Euphrasiologist/euphrasiologist.github.io/pages \
  -d '{"cname": "maxbrown.xyz"}'

# sleep because I think the previous command is being overwritten.
sleep 5
# and switch the source branch to github pages.
curl \
  -i \
  -u "$TOKEN" \
  -X PUT \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/Euphrasiologist/euphrasiologist.github.io/pages \
  -d '{"source":{"branch":"gh-pages"}}'