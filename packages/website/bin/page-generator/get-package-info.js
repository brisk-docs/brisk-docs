// Script for reading the packages and building info needed for the docs website.
// We do not care about the resulting pages in the website at this point,
// this is to gather package info only.

const path = require('path');
const fs = require('fs');
const flatMap = require('lodash.flatmap');
const glob = require('glob');

const getFilesInDir = dirPath => {
  const files = [];
  if (fs.existsSync(dirPath)) {
    // We only care about top level examples right now. This logic will need to become circular
    fs.readdirSync(dirPath).forEach(exampleFile => {
      files.push({
        id: exampleFile.replace(path.extname(exampleFile), ''),
        path: path.resolve(dirPath, exampleFile),
      });
    });
  }
  return files;
};

/**
 * Determines whether a file is a valid example file
 * @param examplePath full path to the file
 * @returns {boolean} whether this file can be rendered as an example
 */
const isExample = examplePath =>
  fs.statSync(examplePath).isFile() && path.extname(examplePath) === '.js';

/**
 * Determines whether a file is a valid doc file
 * @param docPath full path to the file
 * @returns {boolean} whether this file can be rendered as a doc page
 */
const isDoc = docPath => {
  const extname = path.extname(docPath);
  return (
    fs.statSync(docPath).isFile() && (extname === '.md' || extname === '.mdx')
  );
};

/**
 * Resolves a list of glob patterns and returns all of the valid directories matching the patterns.
 * @param searchPatterns array of globs
 * @returns An array of absolute paths
 */
const getAllDirectories = searchPatterns =>
  flatMap(searchPatterns, pattern => glob.sync(pattern)).filter(dirPath =>
    fs.statSync(dirPath).isDirectory(),
  );

/**
 * Gets the contents of the package.json in a directory, if it exists
 * @param pkgPath
 * @returns a package definition, or null
 */
const getPackageDefinition = pkgPath => {
  const pkgJSONPath = path.resolve(pkgPath, 'package.json');

  if (fs.existsSync(pkgJSONPath)) {
    return JSON.parse(fs.readFileSync(pkgJSONPath, 'utf-8'));
  }

  return null;
};

/**
 * Gets the contents of the manifest.json in a directory, if it exists
 * @param pkgPath
 * @returns a manifest definition, or null
 */
const getManifestDefinition = pkgPath => {
  const manifestPath = path.resolve(pkgPath, 'manifest.json');

  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  return null;
};

/**
 * Scans all packages and gathers information that will be shown in the docs website
 * @param packagesPatterns array of glob patterns for directories to be included
 * @param options configuration options
 * @returns An array of objects representing info about each package, and an array
 * of file paths of source files that should be built before being used.
 */
module.exports = function getPackagesInfo(packagesPatterns, options = {}) {
  const defaultOptions = {
    useManifests: false,
  };

  const { useManifests } = { ...defaultOptions, ...options };

  const packagesInfo = getAllDirectories(packagesPatterns)
    .map(pkgPath => {
      const pkgId = path.basename(pkgPath);

      // Get information about the package, either by its package.json
      // or a manifest.json if supported
      let pkgInfo = getPackageDefinition(pkgPath);
      if (!pkgInfo && useManifests) {
        pkgInfo = getManifestDefinition(pkgPath);
      }

      if (!pkgInfo) {
        // This isn't a package. Return false so it isn't included in the docs.
        return false;
      }

      let readmePath = path.resolve(pkgPath, 'README.md');
      if (!fs.existsSync(readmePath)) {
        readmePath = '';
      }
      const exampleDirPath = path.resolve(pkgPath, 'examples');
      const docsDirPath = path.resolve(pkgPath, 'docs');

      const examplesPaths = getFilesInDir(exampleDirPath).filter(
        ({ path: examplePath }) => isExample(examplePath),
      );
      const docsPaths = getFilesInDir(docsDirPath).filter(({ path: docPath }) =>
        isDoc(docPath),
      );

      const packageData = {
        id: pkgId,
        name: pkgInfo.name,
        description: pkgInfo.description,
        version: pkgInfo.version,
        maintainers: pkgInfo.maintainers,
        repository: pkgInfo.repository,
        pkgPath,
        readmePath,
        examplesPaths,
        docsPaths,
      };

      const externalSources = examplesPaths.map(example => example.path);

      return { packageData, externalSources };
    })
    .filter(_ => _);

  const packages = packagesInfo.map(p => p.packageData);
  const externalSources = flatMap(packagesInfo, p => p.externalSources);

  return { packages, externalSources };
};
