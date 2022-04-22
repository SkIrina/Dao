import { ethers } from "hardhat";

async function main() {

  const chairman = '0xAbF78864415e71466DBBB0Bef55ba98F22e468cA';
  const token = '0x241c622e94318d70991Bdcd47077CF0446d7fC81';
  const minQuorum = 100;
  const debatingPeriod = 259200;
  const Dao = await ethers.getContractFactory("Dao");
  const dao = await Dao.deploy(chairman, token, minQuorum, debatingPeriod);

  await dao.deployed();

  console.log("Dao deployed to:", dao.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
