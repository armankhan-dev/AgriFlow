package com.agriflow.config;

import com.agriflow.farm.Farm;
import com.agriflow.farm.FarmRepository;
import com.agriflow.sensor.SensorReading;
import com.agriflow.sensor.SensorReadingRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DemoData {
    @Bean
    @SuppressWarnings("unused")
    public CommandLineRunner seedData(FarmRepository farms, SensorReadingRepository readings) {
        return args -> {
            if (farms.count() > 0) return;
            List<Farm> demoFarms = farms.saveAll(List.of(
                    new Farm("Northfield Organics", "Davis, California", "Tomatoes", 42.5, 38.0, 18400.0),
                    new Farm("Willow Creek Farm", "Salinas, California", "Lettuce", 28.0, 24.0, 12600.0),
                    new Farm("Sunrise Acres", "Fresno, California", "Almonds", 67.2, 31.0, 22100.0),
                    new Farm("Meadow Ridge", "Modesto, California", "Sweet corn", 35.8, 18.0, 15800.0),
                    new Farm("Cedar Lane Produce", "Napa, California", "Peppers", 19.4, 46.0, 9100.0)));
            Instant now = Instant.now();
            for (int i = 0; i < demoFarms.size(); i++) {
                Farm farm = demoFarms.get(i);
                readings.save(new SensorReading(farm, farm.getSoilMoisture(), 22.0 + i * 1.4,
                        i % 2 == 0 ? 1.2 : 0.0, now.minus(i * 18L, ChronoUnit.MINUTES)));
            }
        };
    }
}