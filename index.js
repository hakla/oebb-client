#!/usr/bin/env node

const { format, parse } = require("date-fns");
const inquirer = require("inquirer");
const oebb = require("oebb-hafas");
const vorpal = require("vorpal")();

const argv = process.argv;

function departures(id, cb, duration = 60) {
  oebb.departures(id, { duration }).then(results => {
    const mapped = results.map(r => ({
      date: parse(r.when),
      direction: r.direction,
      name: r.line.name,
      when: time(r.when)
    }));

    cb(mapped);
  });
}

function find(name, cb) {
  oebb.locations(name, { results: 3 }).then(locations => {
    cb(locations);
  });
}

function time(rawDate, pattern = "HH:mm") {
  return format(parse(rawDate), pattern);
}

if (argv.length > 2) {
  const getopts = require("getopts");
  const options = getopts(process.argv.slice(2), {
    alias: {
      d: "duration",
      f: "first"
    }
  });

  const duration = options.duration || 60;
  const name = options._[0];
  const takeFirstStation = options.first || false;

  if (!name) {
    console.warn("Keine Station angegeben");
  } else {
    find(name, results => {
      let result;

      const f = id =>
        departures(
          id,
          results => {
            results.forEach(_ =>
              console.log(`${_.when}: ${_.name} nach ${_.direction}`)
            );
          },
          duration
        );

      if (results.length > 1) {
        if (takeFirstStation) {
          f(results[0].id);
        } else {
          inquirer
            .prompt([
              {
                choices: results.map(result => ({
                  name: result.name,
                  value: result
                })),
                message: "Welche Station?",
                name: "station",
                type: "list"
              }
            ])
            .then(result => {
              f(result.station.id);
            });
        }
      } else {
        console.warn("Keine Stationen gefunden!");
      }
    });
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

  vorpal
    .command("journey <from> <to>")
    .option("-d, --descriptive", "Print way descriptions")
    .alias("j")
    .action((args, callback) => {
      oebb.journeys(args.from.toString(), args.to.toString()).then(results => {
        const way = results[0].legs.reduce(
          (a, b) => a + " => " + b.destination.name,
          results[0].legs[0].origin.name
        );

        results.forEach(result => {
          const way = result.legs.reduce(
            (a, b) => a + "  " + b.arrival + b.destination.name,
            result.legs[0].departures + result.legs[0].origin.name
          );

          console.log(
            time(result.legs[0].departure) +
              " => " +
              time(result.legs[result.legs.length - 1].arrival)
          );

          if (args.options.descriptive) {
            result.legs.forEach(leg => {
              console.log(
                `${leg.origin.name} (${time(leg.departure)})` +
                  " => " +
                  `${leg.destination.name} (${time(leg.arrival)})`
              );
            });

            console.log("");
          }
        });

        callback();
      });
    });

  vorpal.show();
}
