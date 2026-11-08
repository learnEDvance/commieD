clicks = 0
hp = 100
cps = 0
time = 0

while True:

    key = input("Press space to click, Q to quit: ")

    if key == "space" or "left click":
        clicks += 1

    elif key == "q":
        break

    time += 1

    if time == 10:
        cps = clicks / 10

        if cps >= 5:
            hp += 0.2 * cps
        else:
            hp -= 0.2

        clicks = 0
        time = 0

    print("HP:", hp)
    print("CPS:", cps)
    print("Clicks:", clicks)