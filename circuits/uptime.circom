pragma circom 2.1.9;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template UptimeEvidence(maxSlots) {
    // snarkjs puts outputs in this order, then the public inputs from main.
    signal output commitment;
    signal output up;
    signal output down;
    signal output missing;
    signal output result;

    signal input serviceId;
    signal input windowStart;
    signal input intervalMinutes;
    signal input slotCount;
    signal input thresholdBps;
    signal input salt;
    signal input states[maxSlots];

    component serviceBits = Num2Bits(248);
    serviceBits.in <== serviceId;
    component timeBits = Num2Bits(32);
    timeBits.in <== windowStart;
    component saltBits = Num2Bits(248);
    saltBits.in <== salt;
    component saltZero = IsZero();
    saltZero.in <== salt;
    saltZero.out === 0;

    component countBits = Num2Bits(6);
    countBits.in <== slotCount;
    component countBound = LessThan(6);
    countBound.in[0] <== slotCount;
    countBound.in[1] <== maxSlots + 1;
    countBound.out === 1;
    component countZero = IsZero();
    countZero.in <== slotCount;
    countZero.out === 0;

    component intervalBits = Num2Bits(11);
    intervalBits.in <== intervalMinutes;
    component intervalZero = IsZero();
    intervalZero.in <== intervalMinutes;
    intervalZero.out === 0;
    component durationBound = LessThan(17);
    durationBound.in[0] <== intervalMinutes * slotCount;
    durationBound.in[1] <== 1441;
    durationBound.out === 1;

    component thresholdBits = Num2Bits(14);
    thresholdBits.in <== thresholdBps;
    component thresholdBound = LessThan(14);
    thresholdBound.in[0] <== thresholdBps;
    thresholdBound.in[1] <== 10001;
    thresholdBound.out === 1;

    component active[maxSlots];
    component isUp[maxSlots];
    component isDown[maxSlots];
    component stateBits[maxSlots];
    signal numUp[maxSlots + 1];
    signal numDown[maxSlots + 1];
    signal packed[maxSlots + 1];
    numUp[0] <== 0;
    numDown[0] <== 0;
    packed[0] <== 0;
    for (var i = 0; i < maxSlots; i++) {
        active[i] = LessThan(6);
        active[i].in[0] <== i;
        active[i].in[1] <== slotCount;
        stateBits[i] = Num2Bits(2);
        stateBits[i].in <== states[i];
        stateBits[i].out[0] * stateBits[i].out[1] === 0;
        (1 - active[i].out) * states[i] === 0;
        isUp[i] = IsEqual();
        isUp[i].in[0] <== states[i];
        isUp[i].in[1] <== 1;
        isDown[i] = IsEqual();
        isDown[i].in[0] <== states[i];
        isDown[i].in[1] <== 2;
        numUp[i + 1] <== numUp[i] + isUp[i].out;
        numDown[i + 1] <== numDown[i] + isDown[i].out;
        packed[i + 1] <== packed[i] * 4 + states[i];
    }

    up <== numUp[maxSlots];
    down <== numDown[maxSlots];
    missing <== slotCount - up - down;
    component complete = IsZero();
    complete.in <== missing;
    component below = LessThan(20);
    below.in[0] <== up * 10000;
    below.in[1] <== slotCount * thresholdBps;
    result <== 2 * (1 - complete.out) + complete.out * (1 - below.out);

    component checkpoint = Poseidon(8);
    checkpoint.inputs[0] <== 1;
    checkpoint.inputs[1] <== serviceId;
    checkpoint.inputs[2] <== windowStart;
    checkpoint.inputs[3] <== intervalMinutes;
    checkpoint.inputs[4] <== slotCount;
    checkpoint.inputs[5] <== thresholdBps;
    checkpoint.inputs[6] <== packed[maxSlots];
    checkpoint.inputs[7] <== salt;
    commitment <== checkpoint.out;
}

component main {public [serviceId, windowStart, intervalMinutes, slotCount, thresholdBps]} = UptimeEvidence(48);
