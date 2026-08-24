// Metro varsayilan olarak yalnizca kendi proje kokunu (mobile/) izler. Web
// uygulamasiyla paylasilan saf modulleri (../src/lib) gorebilmesi icin depo
// kokunu de izleme listesine ekliyoruz - ADR-029'un dayandigi sey bu.
//
// "@/..." takma adinin cozulmesi icin BURADA bir sey yapmiyoruz: Expo, Metro
// tarafinda tsconfig.json'daki "paths" alanini kendisi okuyor. Takma ad orada
// tanimli (bkz. tsconfig.json).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot];

// Bagimlilik once mobile/node_modules'ta, bulunamazsa kokte aranir. Sira
// onemli: ikisinde de bulunan bir paketin (orn. react) MOBILDEKI surumu
// kazanmali, yoksa Next'in React'i React Native'in icine sizar.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];

module.exports = config;
