import yaml from 'js-yaml';


import { validation } from 'gcp-core';

const { validateFixtures }  = validation // require('gcp-core/cjs').validation;

// Import fixtures from a yaml file and load into a JSON object
export const importFixtures = (config: string) => {
  console.log('Importing fixtures')
  try {
    const data = yaml.load(config);
    const issues: string[] = [];
    if (!validateFixtures(data, issues)) {
      issues.forEach(issue => console.log(issue))
      throw new Error('Invalid fixtures')
    }
    const inserts = generateFixturesImport(data);
  } catch (e) {
    console.error(e);
  }
}

export const importFixturesCsv = (
  csv: string,
  tournamentId: string,
  startDate: string,
  title: string,
  location: string
) => {
  const rows = csv.split('\n').map(row => row.split(','));
  const data = {
    tournamentId: +tournamentId,
    startDate,
    title,
    location,
    activities: rows
  }
  return generateFixturesImport(data);
}

// This function is used to generate the SQL insert statements for the fixtures
const generateFixturesImport = (data: any) => {
 const dataRows = data.activities
      .filter((row: any) => row[0] !== 'matchId') // remove header ow if it exists
      .filter((row: any) => !!(row[0]).trim())
  const { tournamentId, startDate, title, location } = data
  const pitches = new Set()
  dataRows.forEach((fixture: any) => {
    const [,, pitch ] = fixture;
    pitches.add(pitch);
  });
  const insertPitch = (p: string) => {
    // Ensure pitches exist
    return [
      'INSERT INTO `EuroTourno`.`pitches` (pitch, location, type, tournamentId)',
      `VALUES ('${p}', '${location.substring(0, 10)}', 'grass', ${tournamentId})`,
      'ON DUPLICATE KEY UPDATE',
      '    pitch = VALUES(pitch),',
      '    location = VALUES(location),',
      '    type = VALUES(type),',
      '    tournamentId = VALUES(tournamentId);'
    ].join(' ')
  }
  const p = [...pitches].map((p: any) => insertPitch(p));
  const rows = [
    'DELETE FROM `EuroTourno`.`fixtures` WHERE `tournamentId` = ' + (tournamentId-1) + ';',
    'DELETE FROM `EuroTourno`.`fixtures` WHERE `tournamentId` = ' + tournamentId + ';',
    'DELETE FROM `EuroTourno`.`pitches` WHERE `tournamentId` = ' + tournamentId + ';',
    // Ensure the tournament exists
    'INSERT INTO `EuroTourno`.`tournaments` (id, Date, Title, Location, Lat, Lon)',
    `VALUES (${tournamentId}, '${startDate}', '${title}', '${location}', 52.2942, 4.842)`,
    'ON DUPLICATE KEY UPDATE',
    ' Date = VALUES(Date), Title = VALUES(Title), Location = VALUES(Location), Lat = VALUES(Lat), Lon = VALUES(Lon);',
    '-- Update pitches',
    ...p,
    '-- Update fixtures',
    ...dataRows
      .map((fixture: any) => {
        const [id, time, pitch, stage, category, group, team1, team2, umpireTeam] = fixture;
        return [
          "INSERT INTO `EuroTourno`.`fixtures` (",
          " `id`, `tournamentId`, `category`, `groupNumber`, `stage`, `pitch`, ",
          " `scheduled`, `started`, ",
          " `team1Planned`, `team1Id`, `goals1`, `points1`,",
          " `team2Planned`, `team2Id`, `goals2`, `points2`, ",
          " `umpireTeamPlanned`, `umpireTeamId` ",
          ") VALUES ( ",
          ` '${parseInt(id)}', '${tournamentId}', '${category}', '${parseInt(group)}', '${stage}', '${pitch}', `,
          ` '${startDate} ${time}:00', NULL, `,
          ` '${team1}', '${team1}', NULL, NULL, `,
          ` '${team2}', '${team2}', NULL, NULL, `,
          ` '${umpireTeam}', '${umpireTeam}'`,
          ");"
        ].join('');
      })
  ];
  return rows.join('\n');
}

