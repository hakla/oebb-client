#!/usr/bin/env node

const { format, parse } = require("date-fns");
const inquirer = require('inquirer')
const oebb = require("oebb-hafas");
const vorpal = require("vorpal")();

const argv = process.argv;

function departures(id, cb, duration = 60) {
  oebb.departures(id, { duration }).then(results => {
    const mapped = results.map(r => ({
      date: parse(r.when),
      direction: r.direction,
      name: r.line.name,
      when: format(parse(r.when), "HH:mm")
    }));

    cb(mapped);
  });
}

function find(name, cb) {
  oebb.locations(name, { results: 3 }).then(locations => {
    cb(locations);
  });
}

if (argv.length > 2) {
    const getopts = require('getopts')
    const options = getopts(process.argv.slice(2), {
        alias: {
            d: 'duration',
            f: 'first'
        }
    })

    const duration = options.duration || 60
    const name = options._[0]
    const takeFirstStation = options.first || false

    if (!name) {
        console.warn('Keine Station angegeben')
    } else {
        find(name, results => {
            let result

            const f = (id) => departures(id, results => {
                results.forEach(_ => console.log(`${_.when}: ${_.name} nach ${_.direction}`))
            }, duration)

            if (results.length > 1) {
                if (takeFirstStation) {
                    f(results[0].id)
                } else {
                    inquirer.prompt([{
                        choices: results.map(result => ({
                            name: result.name,
                            value: result
                        })),
                        message: 'Welche Station?',
                        name: 'station',
                        type: 'list',
                    }]).then(result => {
                        f(result.station.id)
                    })
                }
            } else {
                console.warn('Keine Stationen gefunden!')
            }
        })
    }
} else {
  vorpal.command("locations <name>").action((args, callback) => {
    find(args.name, locations => {
      console.log(locations.map(l => l.name + " " + l.id));

      callback();
    });
  });

  vorpal
    .command("departures <id>")
    .alias("dep")
    .action((args, callback) => {
      departures(args.id, results => {
        console.log(
          results.map(_ => `${_.when}: ${_.name} nach ${_.direction}`)
        );

        callback();
      });
    });

  vorpal.show();
}
