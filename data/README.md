# Data and scraper
This package contains the Node.js scraper for Unsplash collections. It downloads whole collections, scales them to 100px by 100px, and saves them in labeled folders with a corresponding `source.txt` file containing the link to the original collection.
The package uses yarn for package management, so please run `yarn` before using the package.
The script was designed to be idempotent. However, it is not guarunteed that the number of photos downloaded will be the number of photos in the collection. Running the script again may download some remaining photos, but this behavior is not consistent.

Syntax: `yarn start -- "*list*"` where `*list*` is a JSON list of lists, each of the format `[numeric ID of Unsplash collection, (rough) number of items in collection, pretty]`.

The number of items in the collection can be rounded up without ill effect, but if set too low, some items will not be fetched. `pretty` should be `0` if the photos are categorized as "ugly", `1` if they should be categorized as "pretty".