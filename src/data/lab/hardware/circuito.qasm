OPENQASM 3.0;
bit[4] c;
qubit[4] q;

// peine de periodo 4 sobre 4 qubits + QFT inversa, transpilado por qiskit a [h, cp, swap]

h q[2];
swap q[1], q[2];
h q[3];
swap q[0], q[3];
h q[0];
cphaseshift(-1.570796326794897) q[1], q[0];
h q[1];
cphaseshift(-0.785398163397448) q[2], q[0];
cphaseshift(-1.570796326794897) q[2], q[1];
h q[2];
cphaseshift(-0.392699081698724) q[3], q[0];
cphaseshift(-0.785398163397448) q[3], q[1];
cphaseshift(-1.570796326794897) q[3], q[2];
h q[3];

c = measure q;
