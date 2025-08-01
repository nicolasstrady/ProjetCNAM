package sample;

import client.ClientConnexion;
import client.ServerPoller;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import java.beans.EventHandler;
import java.io.File;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;

public class PartieController {

    @FXML
    private HBox main;
    @FXML
    private Button play;
    @FXML
    private Button take;
    @FXML
    private Button refuse;
    @FXML
    private HBox boxRois;
    @FXML
    private HBox boxChien;
    @FXML
    private HBox boxTour;
    @FXML
    private Button launch;
    @FXML
    private Button playTour;
    @FXML
    private Button endTour;
    @FXML
    private ImageView carteCenter;
    @FXML
    private ImageView dog;
    @FXML
    private Label statusLabel;

    public void play() throws InterruptedException {
        ArrayList<Object> waitsAnswer = new ArrayList<>();
        waitsAnswer.add("WAITANSWER");
        ServerPoller poller = new ServerPoller();
        poller.poll(ConnexionController.host, ConnexionController.port, waitsAnswer,
                resp -> {
                    int current = (int) resp.get(0);
                    String takeFlag = (String) resp.get(1);
                    return current == Integer.parseInt(AccueilController.numJoueur) || takeFlag.equals("TAKE");
                },
                resp -> {
                    int current = (int) resp.get(0);
                    String takeFlag = (String) resp.get(1);
                    int numPlayerTake = (int) resp.get(2);
                    if (takeFlag.equals("TAKE")) {
                        statusLabel.setText("Joueur " + numPlayerTake + " a pris le chien");
                        take(numPlayerTake);
                    } else {
                        statusLabel.setText("A votre tour !");
                        take.setVisible(true);
                        refuse.setVisible(true);
                    }
                });
        play.setVisible(false);


    }

    public void playWithDog() throws InterruptedException {
        ArrayList<Object> chiens = new ArrayList<>();
        chiens.add("CHIEN");
        chiens.add(ConnexionController.idUser);

        ClientConnexion client2 = new ClientConnexion(ConnexionController.host,3333,chiens);
        ArrayList<Object> datas2 = client2.run();
        refuse.setVisible(false);
        take.setVisible(false);
        play();
    }

    public void playWithoutDog() throws InterruptedException {
        ArrayList<Object> refuses = new ArrayList<>();
        refuses.add("REFUSE");
        refuses.add(ConnexionController.idUser);

        ClientConnexion client2 = new ClientConnexion(ConnexionController.host,3333,refuses);
        ArrayList<Object> datas2 = client2.run();
        refuse.setVisible(false);
        take.setVisible(false);
        play();
    }

    public void take(int numPlayerTake) {
        if(numPlayerTake == Integer.parseInt(AccueilController.numJoueur)){
            carteCenter.setVisible(false);
            ArrayList<Object> rois = new ArrayList<>();
            rois.add("ROIS");
            rois.add(ConnexionController.idUser);
            ClientConnexion client2 = new ClientConnexion(ConnexionController.host,3333,rois);
            ArrayList<Object> datas = client2.run();
            ArrayList<String> idCartes = (ArrayList<String>) datas.get(0);
            ArrayList<String> lienCartes = (ArrayList<String>) datas.get(1);
            boxRois.setSpacing(20);
            for(int i = 0; i < idCartes.size() ; i++) {
                    ImageView imageRoi = new ImageView(new Image("/sample/img/" + lienCartes.get(i)));
                    int finalI = i;
                    imageRoi.addEventHandler(javafx.scene.input.MouseEvent.MOUSE_CLICKED, event -> {
                        callKing(idCartes.get(finalI));
                    });
                    boxRois.getChildren().add(imageRoi);
            }
        } else {
            ArrayList<Object> waitcalls = new ArrayList<>();
            waitcalls.add("WAITCALL");
            waitcalls.add(ConnexionController.idUser);
            ServerPoller callPoller = new ServerPoller();
            callPoller.poll(ConnexionController.host, ConnexionController.port, waitcalls,
                    resp -> (boolean) resp.get(0),
                    resp -> {
                        statusLabel.setText("Le Roi de " + resp.get(3) + " a été appelé !");
                        ArrayList<Integer> idCartes = (ArrayList<Integer>) resp.get(1);
                        ArrayList<String> lienCartes = (ArrayList<String>) resp.get(2);
                        for (int i = 0; i < idCartes.size(); i++) {
                            ImageView imageChien = new ImageView(new Image("/sample/img/" + lienCartes.get(i)));
                            boxChien.getChildren().add(imageChien);
                        }
                        carteCenter.setVisible(false);
                        launch.setVisible(true);
                    });
        }
    }
    public void callKing(String idCarte) {
        boxRois.getChildren().clear();
        boxRois.setSpacing(20);
        boxChien.setSpacing(20);
        ArrayList<Object> calls = new ArrayList<>();
        calls.add("CALL");
        calls.add(Integer.parseInt(idCarte));
        calls.add(ConnexionController.idUser);
        ClientConnexion client3 = new ClientConnexion(ConnexionController.host,3333,calls);
        ArrayList<Object> datas2 = client3.run();
        ArrayList<Integer> idCartesChien = (ArrayList) datas2.get(0);
        ArrayList<String> lienCartesChien = (ArrayList) datas2.get(1);
        for(int j = 0; j < idCartesChien.size() ; j++) {
            ImageView imageChien = new ImageView(new Image("/sample/img/" + lienCartesChien.get(j), 40,60,false,false));
            imageChien.setId(idCartesChien.get(j).toString());
            boxChien.getChildren().add(imageChien);

            main.getChildren().add(imageChien);
        }
        for(int i = 0; i< main.getChildren().size() ; i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setOnMouseClicked((e) -> {
                ArrayList<Object> addDogs = new ArrayList<>();
                addDogs.add("ADDDOG");
                addDogs.add(imageCarte.getId());
                ClientConnexion client4 = new ClientConnexion(ConnexionController.host,3333,addDogs);
                ArrayList<Object> datas3 = client4.run();
                boolean dogDone = (boolean) datas3.get(0);
                String ok = (String) datas3.get(1);

                if(ok.equals("OK")) {
                    main.getChildren().remove(imageCarte);
                    boxChien.getChildren().add(new ImageView(imageCarte.getImage()));
                    if(dogDone == true) {
                        launch.setVisible(true);
                        for(int j = 0; j< main.getChildren().size() ; j++) {
                            ImageView imageCarte1 = (ImageView) main.getChildren().get(j);
                            imageCarte1.setDisable(true);
                        }
                    }
                }
                else {
                    statusLabel.setText("Mauvaise carte dans le chien !");
                }

            });
        }
    }

    public void launch() throws InterruptedException {
        launch.setVisible(false);
        boxChien.setVisible(false);
        ArrayList<Object> waitdog = new ArrayList<>();
        waitdog.add("WAITDOG");
        waitdog.add(ConnexionController.idUser);
        ServerPoller dogPoller = new ServerPoller();
        dogPoller.poll(ConnexionController.host, ConnexionController.port, waitdog,
                resp -> (boolean) resp.get(0),
                resp -> playTour.setVisible(true));
    }

    public void playTour() {
        playTour.setVisible(false);
        ArrayList<Object> begins = new ArrayList<>();
        begins.add("BEGIN");
        ClientConnexion client1 = new ClientConnexion(ConnexionController.host,3333,begins);
        client1.run();


        ArrayList<Object> waitTours = new ArrayList<>();
        ServerPoller tourPoller = new ServerPoller();
        tourPoller.poll(ConnexionController.host, ConnexionController.port, waitTours,
                resp -> {
                    int current = (int) resp.get(0);
                    boolean finTour = (boolean) resp.get(1);
                    boolean finPartie = (boolean) resp.get(2);
                    return current == Integer.parseInt(AccueilController.numJoueur) || finTour || finPartie;
                },
                resp -> {
                    int current = (int) resp.get(0);
                    boolean finTour = (boolean) resp.get(1);
                    boolean finPartie = (boolean) resp.get(2);
                    ArrayList<String> idCartes = (ArrayList<String>) resp.get(3);
                    ArrayList<String> lienCartes = (ArrayList<String>) resp.get(4);
                    if (current == Integer.parseInt(AccueilController.numJoueur) && !finTour && !finPartie) {
                        statusLabel.setText("A votre tour !");
                        boxTour.getChildren().clear();
                        for (int i = 0; i < idCartes.size(); i++) {
                            boxTour.getChildren().add(new ImageView(new Image("/sample/img/" + lienCartes.get(i))));
                        }
                    } else if (finTour && !finPartie) {
                        statusLabel.setText("Le tour est fini !");
                        playTour.setVisible(true);
                    } else if (finPartie) {
                        statusLabel.setText("La partie est finie !");
                    } else {
                        statusLabel.setText("Au tour du Joueur " + current);
                    }
                });
        for(int i = 0; i< main.getChildren().size() ; i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setDisable(false);
            int finalI = i;
            imageCarte.setOnMouseClicked((e) -> {
                ArrayList<Object> playTours = new ArrayList<>();
                playTours.add("PLAYTOUR");
                playTours.add(imageCarte.getId());
                playTours.add(ConnexionController.idUser);
                playTours.add(finalI +1);
                ClientConnexion client = new ClientConnexion(ConnexionController.host,3333,playTours);
                ArrayList<Object> datas = client.run();
                boolean hasError = (boolean) datas.get(0);
                if(hasError == false) {
                    main.getChildren().remove(imageCarte);
                    ImageView img = new ImageView(imageCarte.getImage());
                    img.setFitWidth(62);
                    img.setFitHeight(84);
                    boxTour.getChildren().add(img);
                    endTour.setVisible(true);
                }
                else {
                    statusLabel.setText("Carte non valide !");
                }
            });
        }


    }

    public void endTour() {
        playTour();
        endTour.setVisible(false);
    }


}
