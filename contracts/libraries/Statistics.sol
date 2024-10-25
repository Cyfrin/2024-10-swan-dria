// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @notice Simple statistic library for uint256 arrays, numbers are treat as fixed-precision floats.
library Statistics {
    /// @notice Compute the mean of the data.
    /// @param data The data to compute the mean for.
    function avg(uint256[] memory data) internal pure returns (uint256 ans) {
        uint256 sum = 0;
        for (uint256 i = 0; i < data.length; i++) {
            sum += data[i];
        }
        ans = sum / data.length;
    }

    /// @notice Compute the variance of the data.
    /// @param data The data to compute the variance for.
    function variance(uint256[] memory data) internal pure returns (uint256 ans, uint256 mean) {
        mean = avg(data);
        uint256 sum = 0;
        for (uint256 i = 0; i < data.length; i++) {
            uint256 diff = data[i] - mean;
            sum += diff * diff;
        }
        ans = sum / data.length;
    }

    /// @notice Compute the standard deviation of the data.
    /// @dev Computes variance, and takes the square root.
    /// @param data The data to compute the standard deviation for.
    function stddev(uint256[] memory data) internal pure returns (uint256 ans, uint256 mean) {
        (uint256 _variance, uint256 _mean) = variance(data);
        mean = _mean;
        ans = sqrt(_variance);
    }

    /// @notice Compute the square root of a number.
    /// @dev Uses Babylonian method.
    /// @param x The number to compute the square root for.
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
