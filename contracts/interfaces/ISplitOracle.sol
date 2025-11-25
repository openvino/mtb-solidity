// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface ISplitOracle {
    function updateState() external;
    function canSplitView() external view returns (bool);
    function resetRiseTimestamps() external;
}
