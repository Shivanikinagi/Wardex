// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockWstETH
 * @notice Demo-only mock that keeps a 1:1 conversion for getStETHByWstETH.
 */
contract MockWstETH {
    function getStETHByWstETH(uint256 wstETHAmount) external pure returns (uint256) {
        return wstETHAmount;
    }
}
