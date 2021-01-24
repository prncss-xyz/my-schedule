# My Schedule

Custom script to calculate a personal daily schedule relative to local sunset time and
activate a LIFX light accordingly.

Concepts:
- physical computing
- harmonic series

## Schedule

Wake time happens 1 hour before sunrise or at 6 (earlier option). Other events are
calculated relative to wake time. Sleep time is calculated relative to wake time of
the preceding day, thus actual sleep duration slightly varies from set parameter to
keep on with changing sunset time.

Schedule is printed on standard output.

## Light scripts

### Pranayama

Inspired by a yoga breathing exercise. Light turns on to blue, giving user one minute
to prepare. Then light increase and decrease in cycles which duration augment by a 
fixed ratio until reaching desired duration.  User is expected to synchronize breathing 
with light. As the inhaling phase is shorter than exhaling phase, this will activate
parasympathetic system, helping to fall asleep.

It is estimated that blue light exposure is not strong enough to impede sleeping.

### Sunrise

Light will simulate a sunrise transitioning from dim red reaching full power 
cold white at set wake time.
